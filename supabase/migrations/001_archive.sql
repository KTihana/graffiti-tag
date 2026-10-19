-- Graffiti Tag: public reads, authenticated contributions, immutable photo files.
create table public.profiles (
  id uuid primary key references auth.users(id),
  alias text not null check (char_length(alias) between 2 and 40)
);
create table public.moderators (user_id uuid primary key references auth.users(id));
create table public.tags (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), revision integer not null default 1,
  hidden boolean not null default false, merged_into uuid references public.tags(id)
);
create index tags_location on public.tags(latitude, longitude) where not hidden;
create table public.artworks (
  id uuid primary key default gen_random_uuid(), tag_id uuid not null references public.tags(id),
  title text not null check (char_length(trim(title)) between 2 and 100),
  artist text not null check (char_length(artist) between 1 and 100),
  kind text not null check (kind in ('Piece','Mural','Lettering','Stencil','Other')),
  unique (id, tag_id)
);
create table public.photos (
  id uuid primary key, tag_id uuid not null references public.tags(id), artwork_id uuid not null,
  original_path text not null unique, preview_path text not null unique,
  year integer, taken_on date, precision text not null check (precision in ('exact','year','approximate','unknown')),
  condition text not null check (condition in ('present','faded','covered','gone')),
  caption text not null default '' check (char_length(caption) <= 2000),
  photographer text not null check (char_length(photographer) between 1 and 100),
  created_by uuid not null references auth.users(id), uploaded_at timestamptz not null default now(),
  rights_confirmed boolean not null check (rights_confirmed),
  foreign key (artwork_id,tag_id) references public.artworks(id,tag_id) deferrable initially deferred,
  check ((precision = 'unknown' and year is null and taken_on is null) or
    (precision in ('year','approximate') and year is not null and year between 1826 and extract(year from (now() at time zone 'UTC' + interval '14 hours')) and taken_on is null) or
    (precision = 'exact' and year is not null and year between 1826 and extract(year from (now() at time zone 'UTC' + interval '14 hours')) and taken_on is not null and extract(year from taken_on) = year and taken_on <= (now() at time zone 'UTC' + interval '14 hours')::date))
);
create index photos_wall on public.photos(tag_id);
create index photos_contributor on public.photos(created_by, uploaded_at);
create table public.revisions (
  id uuid primary key default gen_random_uuid(), tag_id uuid not null references public.tags(id),
  actor text not null, actor_id uuid not null references auth.users(id), action text not null,
  created_at timestamptz not null default now(), before jsonb, after jsonb not null, version integer not null
);
create index revisions_wall on public.revisions(tag_id, created_at desc);
create table public.reports (
  id uuid primary key default gen_random_uuid(), tag_id uuid not null references public.tags(id),
  reporter uuid not null default auth.uid() references auth.users(id), reason text not null check (char_length(trim(reason)) between 8 and 2000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(), resolved_by uuid references auth.users(id), resolved_at timestamptz
);

create function public.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,alias) values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'alias'),''),'Contributor'),40));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
create function public.is_moderator() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.moderators where user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.moderators enable row level security;
alter table public.tags enable row level security;
alter table public.artworks enable row level security;
alter table public.photos enable row level security;
alter table public.revisions enable row level security;
alter table public.reports enable row level security;
create policy profiles_read on public.profiles for select using (true);
create policy moderator_self on public.moderators for select to authenticated using (user_id = auth.uid());
create policy tags_read on public.tags for select using (not hidden or public.is_moderator());
create policy artworks_read on public.artworks for select using (exists(select 1 from public.tags where id = tag_id));
create policy photos_read on public.photos for select using (exists(select 1 from public.tags where id = tag_id));
create policy revisions_read on public.revisions for select using (exists(select 1 from public.tags where id = tag_id));
create policy reports_create on public.reports for insert to authenticated with check (reporter = auth.uid() and status = 'open' and resolved_by is null and resolved_at is null);
create policy reports_read on public.reports for select to authenticated using (reporter = auth.uid() or public.is_moderator());
-- Table writes are only exposed through the narrow RPCs below (reports are insert-only).
revoke all on public.tags, public.artworks, public.photos, public.revisions, public.profiles, public.moderators, public.reports from anon, authenticated;
grant select on public.tags, public.artworks, public.photos, public.revisions, public.profiles to anon, authenticated;
grant select on public.moderators, public.reports to authenticated;
grant insert(tag_id,reason) on public.reports to authenticated;

create function public.tag_fields(t public.tags) returns jsonb language sql stable as $$
  select jsonb_build_object('title',t.title,'description',t.description,'latitude',t.latitude,'longitude',t.longitude);
$$;
create function public.read_tag(tag_id uuid) returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'latitude',t.latitude,'longitude',t.longitude,'revision',t.revision,'createdAt',t.created_at,
    'artworks',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'artist',a.artist,'kind',a.kind) order by a.id) from public.artworks a where a.tag_id=t.id),'[]'::jsonb),
    'photos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'artworkId',p.artwork_id,'uri','','previewPath',p.preview_path,'year',p.year,'takenOn',p.taken_on,'precision',p.precision,'condition',p.condition,'caption',p.caption,'photographer',p.photographer,'contributor',pr.alias,'uploadedAt',p.uploaded_at) order by p.year desc nulls last,p.taken_on desc nulls last,p.uploaded_at desc) from public.photos p join public.profiles pr on pr.id=p.created_by where p.tag_id=t.id),'[]'::jsonb))
  from public.tags t where t.id=tag_id and not t.hidden;
$$;
create function public.browse_tags(center_lat double precision default 0, center_lng double precision default 0, lat_span double precision default 180, lng_span double precision default 360, search_text text default '') returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select public.read_tag(t.id) from public.tags t where not t.hidden and (
    (search_text = '' and abs(t.latitude-center_lat) <= least(abs(lat_span),180)/2 and
      abs(mod((t.longitude-center_lng+540)::numeric,360)-180) <= least(abs(lng_span),360)/2) or
    (search_text <> '' and (t.title ilike '%'||search_text||'%' or t.description ilike '%'||search_text||'%' or exists(select 1 from public.artworks a where a.tag_id=t.id and (a.title ilike '%'||search_text||'%' or a.artist ilike '%'||search_text||'%')))))
  order by t.updated_at desc limit 250;
$$;

create function public.add_contribution(payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
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
    insert into public.artworks(id,tag_id,title,artist,kind) values (aid,tid,a->>'title',a->>'artist',a->>'kind');
  elsif not exists(select 1 from public.artworks where id=aid and tag_id=tid) then raise exception 'Choose an artwork from this wall.';
  end if;
  insert into public.photos(id,tag_id,artwork_id,original_path,preview_path,year,taken_on,precision,condition,caption,photographer,created_by,rights_confirmed)
    values (pid,tid,aid,p->>'originalPath',p->>'previewPath',(p->>'year')::integer,(p->>'takenOn')::date,p->>'precision',p->>'condition',coalesce(p->>'caption',''),p->>'photographer',uid,true);
  update public.tags set updated_at=now() where id=tid returning * into current_tag;
  insert into public.revisions(tag_id,actor,actor_id,action,after,version) values (tid,display_name,uid,'Added a photograph',public.tag_fields(current_tag),current_tag.revision);
  return tid;
end $$;
create function public.edit_tag(tag_id uuid, expected_revision integer, changes jsonb, reason text) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); old_tag public.tags; next_tag public.tags; display_name text;
begin
  if uid is null then raise exception 'Sign in to edit.'; end if;
  if char_length(trim(reason)) not between 5 and 500 then raise exception 'Explain the change in 5 to 500 characters.'; end if;
  if (select count(*) from public.revisions where actor_id=uid and created_at>now()-interval '1 hour') >= 100 then raise exception 'Edit limit reached. Try again later.'; end if;
  select * into old_tag from public.tags where id=tag_id and not hidden for update;
  if not found then raise exception 'This wall is not available.'; end if;
  if old_tag.revision <> expected_revision then raise exception 'This tag changed. Refresh it before editing.'; end if;
  select alias into display_name from public.profiles where id=uid;
  update public.tags set title=changes->>'title',description=changes->>'description',latitude=(changes->>'latitude')::double precision,longitude=(changes->>'longitude')::double precision,revision=revision+1,updated_at=now() where id=tag_id returning * into next_tag;
  insert into public.revisions(tag_id,actor,actor_id,action,before,after,version) values (tag_id,display_name,uid,reason,public.tag_fields(old_tag),public.tag_fields(next_tag),next_tag.revision);
end $$;
create function public.resolve_report(report_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Moderator access required.'; end if;
  update public.reports set status='resolved',resolved_by=auth.uid(),resolved_at=now() where id=report_id;
end $$;
-- Administrative operations preserve all photos and audit trails. No public hard-delete endpoint.
create function public.hide_tag(tag_id uuid, reason text) returns void language plpgsql security definer set search_path = '' as $$
declare t public.tags;
begin
  if not public.is_moderator() then raise exception 'Moderator access required.'; end if;
  if char_length(trim(reason)) < 8 then raise exception 'Explain why the tag is hidden.'; end if;
  update public.tags set hidden=true,updated_at=now(),revision=revision+1 where id=tag_id returning * into t;
  if not found then raise exception 'Tag not found.'; end if;
  insert into public.revisions(tag_id,actor,actor_id,action,before,after,version) select tag_id,alias,auth.uid(),'Hidden: '||reason,public.tag_fields(t),public.tag_fields(t),t.revision from public.profiles where id=auth.uid();
end $$;
create function public.merge_tags(source_id uuid, destination_id uuid, reason text) returns void language plpgsql security definer set search_path = '' as $$
declare t public.tags;
begin
  if not public.is_moderator() then raise exception 'Moderator access required.'; end if;
  if source_id=destination_id or char_length(trim(reason))<8 then raise exception 'Choose different walls and explain the merge.'; end if;
  perform id from public.tags where id in(source_id,destination_id) order by id for update;
  if (select count(*) from public.tags where id in(source_id,destination_id) and not hidden)<>2 then raise exception 'Both walls must be available.'; end if;
  update public.artworks set tag_id=destination_id where tag_id=source_id;
  update public.photos set tag_id=destination_id where tag_id=source_id;
  update public.tags set hidden=true,merged_into=destination_id,updated_at=now() where id=source_id;
  update public.tags set updated_at=now(),revision=revision+1 where id=destination_id returning * into t;
  insert into public.revisions(tag_id,actor,actor_id,action,after,version) select destination_id,alias,auth.uid(),'Merged wall '||source_id::text||': '||reason,public.tag_fields(t),t.revision from public.profiles where id=auth.uid();
end $$;

-- Supabase Storage. Originals are private; resized previews are public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('originals','originals',false,31457280,array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
 ('previews','previews',true,5242880,array['image/jpeg']);
create policy photo_upload on storage.objects for insert to authenticated with check (bucket_id in ('originals','previews') and (storage.foldername(name))[1]=auth.uid()::text);
create policy photo_original_read on storage.objects for select to authenticated using (bucket_id='originals' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_moderator()));
-- No update/delete storage policy: one user cannot overwrite or remove another's photographs.
revoke all on function public.new_profile() from public;
revoke all on function public.is_moderator() from public;
revoke all on function public.tag_fields(public.tags) from public;
revoke all on function public.read_tag(uuid) from public;
revoke all on function public.browse_tags(double precision,double precision,double precision,double precision,text) from public;
revoke all on function public.add_contribution(jsonb) from public;
revoke all on function public.edit_tag(uuid,integer,jsonb,text) from public;
revoke all on function public.resolve_report(uuid) from public;
revoke all on function public.hide_tag(uuid,text) from public;
revoke all on function public.merge_tags(uuid,uuid,text) from public;
grant execute on function public.is_moderator(),public.read_tag(uuid),public.browse_tags(double precision,double precision,double precision,double precision,text) to anon,authenticated;
grant execute on function public.add_contribution(jsonb),public.edit_tag(uuid,integer,jsonb,text),public.resolve_report(uuid),public.hide_tag(uuid,text),public.merge_tags(uuid,uuid,text) to authenticated;
-- Enable push invalidation for clients. Queries still obey RLS.
alter publication supabase_realtime add table public.tags;
