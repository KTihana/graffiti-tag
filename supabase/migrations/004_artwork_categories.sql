-- Preserve old single-category clients and archives while allowing several categories.
alter table public.artworks add column kinds text[];
update public.artworks set kinds=array[kind];
alter table public.artworks alter column kinds set not null;

create function public.valid_artwork_kinds(values_ text[]) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(cardinality(values_) between 1 and 5
    and array_position(values_,null) is null
    and values_ <@ array['Piece','Mural','Lettering','Stencil','Other']::text[]
    and cardinality(values_)=(select count(distinct v) from unnest(values_) v),false);
$$;
alter table public.artworks add constraint artwork_kinds_valid
  check(public.valid_artwork_kinds(kinds) and kind=kinds[1]);

create function public.legacy_artwork_kind() returns trigger language plpgsql set search_path='' as $$
begin
  if new.kinds is null then new.kinds:=array[new.kind];
  elsif TG_OP='UPDATE' then
    if new.kind is distinct from old.kind and new.kinds is not distinct from old.kinds then
      new.kinds:=array[new.kind];
    end if;
  end if;
  return new;
end $$;
create trigger legacy_artwork_kind before insert or update on public.artworks
  for each row execute function public.legacy_artwork_kind();

create or replace function public.read_tag(tag_id uuid) returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'latitude',t.latitude,'longitude',t.longitude,'revision',t.revision,'createdAt',t.created_at,
    'artworks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'artist',a.artist,'kind',a.kind,'kinds',to_jsonb(a.kinds)) order by a.id) from public.artworks a where a.tag_id=t.id),'[]'::jsonb),
    'photos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'artworkId',p.artwork_id,'uri','','previewPath',p.preview_path,'year',p.year,'takenOn',p.taken_on,'precision',p.precision,'condition',p.condition,'caption',p.caption,'photographer',p.photographer,'contributor',pr.alias,'uploadedAt',p.uploaded_at) order by p.year desc nulls last,p.taken_on desc nulls last,p.uploaded_at desc) from public.photos p join public.profiles pr on pr.id=p.created_by where p.tag_id=t.id),'[]'::jsonb))
  from public.tags t where t.id=tag_id and not t.hidden;
$$;

create or replace function public.add_contribution(payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); tid uuid; aid uuid; pid uuid := (payload->'photo'->>'id')::uuid;
  w jsonb := payload->'wall'; a jsonb := payload->'artwork'; p jsonb := payload->'photo';
  display_name text; current_tag public.tags;
begin
  if uid is null then raise exception 'Sign in to contribute.'; end if;
  select alias into display_name from public.profiles where id=uid;
  if exists(select 1 from public.photos where id=pid and created_by=uid) then select tag_id into tid from public.photos where id=pid; return tid; end if;
  if (select count(*) from public.photos where created_by=uid and uploaded_at > now()-interval '1 hour') >= 30 then raise exception 'Contribution limit reached. Try again later.'; end if;
  if (payload->>'rightsConfirmed')::boolean is distinct from true then raise exception 'Confirm permission to share the photo.'; end if;
  if split_part(p->>'originalPath','/',1) <> uid::text or split_part(p->>'previewPath','/',1) <> uid::text or
     not exists(select 1 from storage.objects where bucket_id='originals' and name=p->>'originalPath') or
     not exists(select 1 from storage.objects where bucket_id='previews' and name=p->>'previewPath') then raise exception 'Upload both photo files under your account first.'; end if;
  tid := (payload->>'tagId')::uuid;
  if tid is null then
    insert into public.tags(title,description,latitude,longitude,created_by) values (w->>'title',coalesce(w->>'description',''),(w->>'latitude')::double precision,(w->>'longitude')::double precision,uid) returning id into tid;
  else
    select * into current_tag from public.tags where id=tid and not hidden for update;
    if not found then raise exception 'This wall is not available.'; end if;
  end if;
  aid := (payload->>'artworkId')::uuid;
  if aid is null then
    aid := (a->>'id')::uuid;
    insert into public.artworks(id,tag_id,title,artist,kind,kinds) values (aid,tid,a->>'title',a->>'artist',a->>'kind',case when a ? 'kinds' then array(select jsonb_array_elements_text(a->'kinds')) else array[a->>'kind'] end);
  elsif not exists(select 1 from public.artworks where id=aid and tag_id=tid) then raise exception 'Choose an artwork from this wall.';
  end if;
  insert into public.photos(id,tag_id,artwork_id,original_path,preview_path,year,taken_on,precision,condition,caption,photographer,created_by,rights_confirmed)
    values (pid,tid,aid,p->>'originalPath',p->>'previewPath',(p->>'year')::integer,(p->>'takenOn')::date,p->>'precision',p->>'condition',coalesce(p->>'caption',''),p->>'photographer',uid,true);
  update public.tags set updated_at=now() where id=tid returning * into current_tag;
  insert into public.revisions(tag_id,actor,actor_id,action,after,version) values (tid,display_name,uid,'Added a photograph',public.tag_fields(current_tag),current_tag.revision);
  return tid;
end $$;

create or replace function public.record_details(p public.photos,a public.artworks) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('photoId',p.id,'artworkTitle',a.title,'artist',a.artist,'kind',a.kind,'kinds',to_jsonb(a.kinds),'year',p.year,'takenOn',p.taken_on,'precision',p.precision,'condition',p.condition,'caption',p.caption,'photographer',p.photographer);
$$;
create or replace function public.edit_record(tag_id uuid,photo_id uuid,expected_revision integer,changes jsonb,reason text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); wall public.tags; old_photo public.photos; old_art public.artworks; new_photo public.photos; new_art public.artworks; display_name text;
begin
  if uid is null then raise exception 'Sign in to correct a record.'; end if;
  if char_length(trim(reason)) not between 5 and 500 then raise exception 'Explain the correction in 5 to 500 characters.'; end if;
  if (select count(*) from public.revisions where actor_id=uid and created_at>now()-interval '1 hour')>=100 then raise exception 'Edit limit reached. Try again later.'; end if;
  select * into wall from public.tags where id=tag_id and not hidden for update;
  if not found then raise exception 'This wall is not available.'; end if;
  if wall.revision<>expected_revision then raise exception 'This tag changed. Refresh it before editing.'; end if;
  select * into old_photo from public.photos p where p.id=photo_id and p.tag_id=edit_record.tag_id;
  if not found then raise exception 'Choose a photograph from this wall.'; end if;
  select * into old_art from public.artworks where id=old_photo.artwork_id;
  select alias into display_name from public.profiles where id=uid;
  update public.photos set year=(changes->>'year')::integer,taken_on=(changes->>'takenOn')::date,precision=changes->>'precision',condition=changes->>'condition',caption=changes->>'caption',photographer=changes->>'photographer' where id=photo_id returning * into new_photo;
  update public.artworks set title=changes->>'artworkTitle',artist=coalesce(nullif(changes->>'artist',''),'Unknown artist'),kind=changes->>'kind',kinds=case when changes ? 'kinds' then array(select jsonb_array_elements_text(changes->'kinds')) else array[changes->>'kind'] end where id=old_art.id returning * into new_art;
  update public.tags set revision=revision+1,updated_at=now() where id=tag_id;
  insert into public.revisions(tag_id,actor,actor_id,action,before,after,version) values (tag_id,display_name,uid,reason,public.tag_fields(wall)||jsonb_build_object('record',public.record_details(old_photo,old_art)),public.tag_fields(wall)||jsonb_build_object('record',public.record_details(new_photo,new_art)),wall.revision+1);
end $$;
