-- Public aggregate likes; saves and collections are private to their owner.
create table public.artwork_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id),
  primary key(user_id, artwork_id)
);
create index artwork_likes_piece on public.artwork_likes(artwork_id);
create table public.saved_artworks (
  user_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id),
  primary key(user_id, artwork_id)
);
create table public.graffiti_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(trim(name)) between 1 and 60),
  unique(id,user_id)
);
create unique index collection_owner_name on public.graffiti_collections(user_id,lower(name));
create table public.collection_artworks (
  collection_id uuid not null,
  user_id uuid not null,
  artwork_id uuid not null,
  primary key(collection_id, artwork_id),
  foreign key(collection_id,user_id) references public.graffiti_collections(id,user_id) on delete cascade,
  foreign key(user_id,artwork_id) references public.saved_artworks(user_id,artwork_id) on delete cascade
);
alter table public.artwork_likes enable row level security;
alter table public.saved_artworks enable row level security;
alter table public.graffiti_collections enable row level security;
alter table public.collection_artworks enable row level security;
create policy likes_owner on public.artwork_likes for select to authenticated using(user_id=auth.uid());
create policy saves_owner on public.saved_artworks for select to authenticated using(user_id=auth.uid());
create policy collections_owner on public.graffiti_collections for select to authenticated using(user_id=auth.uid());
create policy membership_owner on public.collection_artworks for select to authenticated using(user_id=auth.uid());
revoke all on public.artwork_likes,public.saved_artworks,public.graffiti_collections,public.collection_artworks from anon,authenticated;
grant select on public.artwork_likes,public.saved_artworks,public.graffiti_collections,public.collection_artworks to authenticated;

-- This intentionally returns counts, never identities of other people who liked a piece.
create function public.read_social() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'counts',coalesce((select jsonb_object_agg(artwork_id,n) from (
      select l.artwork_id,count(*)::int n from public.artwork_likes l
      join public.artworks a on a.id=l.artwork_id join public.tags t on t.id=a.tag_id
      where not t.hidden group by l.artwork_id) counts),'{}'::jsonb),
    'liked',coalesce((select jsonb_agg(artwork_id) from public.artwork_likes where user_id=auth.uid()),'[]'::jsonb),
    'pieces',coalesce((select jsonb_agg(jsonb_build_object('artworkId',s.artwork_id,'tagId',a.tag_id))
      from public.saved_artworks s join public.artworks a on a.id=s.artwork_id
      join public.tags t on t.id=a.tag_id where s.user_id=auth.uid() and not t.hidden),'[]'::jsonb),
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,
      'artworkIds',coalesce((select jsonb_agg(m.artwork_id) from public.collection_artworks m
        join public.artworks a on a.id=m.artwork_id join public.tags t on t.id=a.tag_id
        where m.collection_id=c.id and m.user_id=auth.uid() and not t.hidden),'[]'::jsonb)) order by c.name)
      from public.graffiti_collections c where c.user_id=auth.uid()),'[]'::jsonb));
$$;
create function public.change_social(action jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); kind text:=action->>'kind'; aid uuid; cid uuid; enabled boolean:=coalesce((action->>'enabled')::boolean,false); cname text:=trim(action->>'name');
begin
  if uid is null then raise exception 'Sign in to like pieces and keep private collections.'; end if;
  -- Serialize each user's changes across devices, including save/remove and collection changes.
  perform id from auth.users where id=uid for update;
  if kind in ('like','save','membership') then
    aid:=(action->>'artworkId')::uuid;
    if not exists(select 1 from public.artworks a join public.tags t on t.id=a.tag_id where a.id=aid and not t.hidden) then
      raise exception 'This piece is no longer available.';
    end if;
  end if;
  if kind in ('membership','rename','delete') then
    cid:=(action->>'collectionId')::uuid;
    if not exists(select 1 from public.graffiti_collections where id=cid and user_id=uid) then
      raise exception 'This collection no longer exists.';
    end if;
  end if;
  if kind in ('create','rename') then
    if cname is null or char_length(cname) not between 1 and 60 then raise exception 'Use a collection name between 1 and 60 characters.'; end if;
    if exists(select 1 from public.graffiti_collections where user_id=uid and lower(name)=lower(cname) and id is distinct from cid) then
      raise exception 'You already have a collection with this name.';
    end if;
  end if;
  if kind='like' then
    if enabled then insert into public.artwork_likes values(uid,aid) on conflict do nothing;
    else delete from public.artwork_likes where user_id=uid and artwork_id=aid; end if;
  elsif kind='save' or kind='membership' then
    if enabled then insert into public.saved_artworks values(uid,aid) on conflict do nothing; end if;
    if kind='save' and not enabled then delete from public.saved_artworks where user_id=uid and artwork_id=aid; end if;
    if kind='membership' then
      if enabled then insert into public.collection_artworks values(cid,uid,aid) on conflict do nothing;
      else delete from public.collection_artworks where collection_id=cid and user_id=uid and artwork_id=aid; end if;
    end if;
  elsif kind='create' then
    insert into public.graffiti_collections(id,user_id,name) values((action->>'collectionId')::uuid,uid,cname);
  elsif kind='rename' then update public.graffiti_collections set name=cname where id=cid and user_id=uid;
  elsif kind='delete' then delete from public.graffiti_collections where id=cid and user_id=uid;
  else raise exception 'Unknown collection action.';
  end if;
  return public.read_social();
end $$;
revoke all on function public.read_social(),public.change_social(jsonb) from public;
grant execute on function public.read_social() to anon,authenticated;
grant execute on function public.change_social(jsonb) to authenticated;
