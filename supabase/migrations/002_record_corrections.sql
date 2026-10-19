-- Community corrections preserve immutable source files and a recoverable record.
create function public.record_details(p public.photos,a public.artworks) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('photoId',p.id,'artworkTitle',a.title,'artist',a.artist,'kind',a.kind,'year',p.year,'takenOn',p.taken_on,'precision',p.precision,'condition',p.condition,'caption',p.caption,'photographer',p.photographer);
$$;
create function public.edit_record(tag_id uuid,photo_id uuid,expected_revision integer,changes jsonb,reason text) returns void language plpgsql security definer set search_path='' as $$
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
  update public.artworks set title=changes->>'artworkTitle',artist=coalesce(nullif(changes->>'artist',''),'Unknown artist'),kind=changes->>'kind' where id=old_art.id returning * into new_art;
  update public.tags set revision=revision+1,updated_at=now() where id=tag_id;
  insert into public.revisions(tag_id,actor,actor_id,action,before,after,version) values (tag_id,display_name,uid,reason,public.tag_fields(wall)||jsonb_build_object('record',public.record_details(old_photo,old_art)),public.tag_fields(wall)||jsonb_build_object('record',public.record_details(new_photo,new_art)),wall.revision+1);
end $$;
revoke all on function public.record_details(public.photos,public.artworks) from public;
revoke all on function public.edit_record(uuid,uuid,integer,jsonb,text) from public;
grant execute on function public.edit_record(uuid,uuid,integer,jsonb,text) to authenticated;

create function public.limit_reports() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from public.reports where reporter=new.reporter and created_at>now()-interval '1 hour')>=10 then raise exception 'Report limit reached. Try again later.'; end if;
  return new;
end $$;
revoke all on function public.limit_reports() from public;
create trigger limit_reports before insert on public.reports for each row execute function public.limit_reports();
