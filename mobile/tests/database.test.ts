import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('database enforces public reads, accountable edits, photo preservation, and moderation', async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant insert,select on storage.objects to authenticated;
    create publication supabase_realtime;`);
  await db.exec(
    await readFile(new URL('../../supabase/migrations/001_archive.sql', import.meta.url), 'utf8'),
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/002_record_corrections.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(await readFile(new URL('../../supabase/migrations/003_likes_collections.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/004_artwork_categories.sql', import.meta.url), 'utf8'));
  const user = randomUUID(),
    other = randomUUID();
  await db.query(
    `insert into auth.users(id,raw_user_meta_data) values ($1,'{"alias":"Archivist"}'),($2,'{"alias":"Neighbour"}')`,
    [user, other],
  );
  const login = async (uid: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
    await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
  };
  const payload = async (uid: string, tagId?: string, artworkId?: string) => {
    const id = randomUUID();
    await db.query('insert into storage.objects(bucket_id,name) values ($1,$2),($3,$4)', [
      'originals',
      `${uid}/${id}.jpg`,
      'previews',
      `${uid}/${id}.jpg`,
    ]);
    return {
      tagId: tagId ?? null,
      artworkId: artworkId ?? null,
      wall: {
        title: 'Railway wall',
        description: 'An east-facing wall',
        latitude: 45.8,
        longitude: 15.9,
      },
      artwork: { id: randomUUID(), title: 'Untitled', artist: 'Unknown', kind: 'Piece' },
      photo: {
        id,
        originalPath: `${uid}/${id}.jpg`,
        previewPath: `${uid}/${id}.jpg`,
        year: 2007,
        takenOn: null,
        precision: 'year',
        condition: 'present',
        caption: 'An old photograph',
        photographer: 'Archivist',
      },
      rightsConfirmed: true,
    };
  };
  let tagId = '',
    artworkId = '';
  await t.test('anonymous visitors cannot create records', async () => {
    await login(null);
    await assert.rejects(db.query('select public.add_contribution($1)', [{}]), /permission denied/);
  });
  await t.test('authenticated contribution is atomic and publicly readable', async () => {
    await login(user);
    const p = await payload(user);
    artworkId = p.artwork.id;
    const result = await db.query<{ id: string }>('select public.add_contribution($1) as id', [p]);
    tagId = result.rows[0].id;
    await login(null);
    const result2 = await db.query<{ tag: any }>('select public.read_tag($1) as tag', [tagId]);
    assert.equal(result2.rows[0].tag.photos[0].year, 2007);
    assert.equal(result2.rows[0].tag.photos[0].contributor, 'Archivist');
  });
  await t.test('any signed-in user can add a photo to the same artwork', async () => {
    await login(other);
    const p = await payload(other, tagId, artworkId);
    p.photo.year = 2012;
    await db.query('select public.add_contribution($1)', [p]);
    const result = await db.query<{ n: number }>(
      'select count(*)::int as n from public.photos where tag_id=$1',
      [tagId],
    );
    assert.equal(result.rows[0].n, 2);
  });
  await t.test(
    'direct table edits, photo deletion, and moderator self-promotion are denied',
    async () => {
      await login(other);
      for (const sql of [
        "update public.tags set title='vandalized'",
        'delete from public.photos',
        'delete from storage.objects',
        `insert into public.moderators(user_id) values ('${other}')`,
      ])
        await assert.rejects(db.exec(sql), /permission denied/);
    },
  );
  await t.test('date validation cannot be bypassed with null years or future dates', async () => {
    await login(user);
    for (const overrides of [
      { year: null },
      { year: 3000 },
      { year: 2007, precision: 'exact', takenOn: '2008-01-01' },
    ]) {
      const p = await payload(user);
      Object.assign(p.photo, overrides);
      await assert.rejects(db.query('select public.add_contribution($1)', [p]), /check constraint/);
    }
    assert.equal(
      (await db.query<{ n: number }>('select count(*)::int as n from public.tags')).rows[0].n,
      1,
    );
  });
  await t.test('cross-wall artwork references and foreign upload paths are rejected', async () => {
    const p = await payload(user);
    p.artworkId = artworkId;
    await assert.rejects(db.query('select public.add_contribution($1)', [p]), /Choose an artwork/);
    const foreign = await payload(user, tagId);
    foreign.photo.originalPath = `${other}/fake.jpg`;
    await assert.rejects(db.query('select public.add_contribution($1)', [foreign]), /Upload both/);
  });
  await t.test(
    'edits record their actor and before/after values, and reject stale revisions',
    async () => {
      const changes = {
        title: 'Corrected wall name',
        description: 'Corrected context',
        latitude: 45.81,
        longitude: 15.91,
      };
      await db.query('select public.edit_tag($1,1,$2,$3)', [
        tagId,
        changes,
        'Corrected the location',
      ]);
      await assert.rejects(
        db.query('select public.edit_tag($1,1,$2,$3)', [tagId, changes, 'A stale edit']),
        /This tag changed/,
      );
      const r = await db.query<{ before: any; after: any; actor: string }>(
        'select before,after,actor from public.revisions where tag_id=$1 and before is not null',
        [tagId],
      );
      assert.equal(r.rows[0].before.title, 'Railway wall');
      assert.equal(r.rows[0].after.title, changes.title);
      assert.equal(r.rows[0].actor, 'Archivist');
    },
  );
  await t.test(
    'photo and artist corrections preserve image files and are recoverable',
    async () => {
      const p = (
        await db.query<any>('select * from public.photos where tag_id=$1 limit 1', [tagId])
      ).rows[0];
      const changes = {
        photoId: p.id,
        artworkTitle: 'Corrected artwork',
        artist: 'Artist alias',
        kind: 'Piece',
        year: 2005,
        takenOn: null,
        precision: 'approximate',
        condition: 'present',
        caption: 'Date corrected from the original print',
        photographer: 'Photographer alias',
      };
      await db.query('select public.edit_record($1,$2,2,$3,$4)', [
        tagId,
        p.id,
        changes,
        'Corrected artist attribution and date',
      ]);
      const updated = (await db.query<any>('select * from public.photos where id=$1', [p.id]))
        .rows[0];
      assert.equal(updated.original_path, p.original_path);
      assert.equal(updated.preview_path, p.preview_path);
      assert.equal(updated.year, 2005);
      const rev = (
        await db.query<any>(
          "select before,after from public.revisions where tag_id=$1 and before ? 'record'",
          [tagId],
        )
      ).rows[0];
      assert.equal(rev.before.record.year, p.year);
      assert.equal(rev.after.record.artist, 'Artist alias');
      await db.query('select public.edit_record($1,$2,3,$3,$4)', [
        tagId,
        p.id,
        rev.before.record,
        'Restored previous photo details',
      ]);
      assert.equal(
        (await db.query<any>('select year from public.photos where id=$1', [p.id])).rows[0].year,
        p.year,
      );
    },
  );
  await t.test('reports can only be resolved by moderators', async () => {
    await db.query('insert into public.reports(tag_id,reason) values ($1,$2)', [
      tagId,
      'This appears to be a duplicate wall',
    ]);
    const report = (await db.query<{ id: string }>('select id from public.reports')).rows[0].id;
    await assert.rejects(
      db.query('select public.resolve_report($1)', [report]),
      /Moderator access required/,
    );
    await db.exec('reset role');
    await db.query('insert into public.moderators(user_id) values ($1)', [user]);
    await login(user);
    await db.query('select public.resolve_report($1)', [report]);
    assert.equal(
      (
        await db.query<{ status: string }>('select status from public.reports where id=$1', [
          report,
        ])
      ).rows[0].status,
      'resolved',
    );
  });
  await t.test('moderator merging preserves photographs and their artwork links', async () => {
    const p = await payload(user);
    const second = (await db.query<{ id: string }>('select public.add_contribution($1) as id', [p]))
      .rows[0].id;
    await db.query('select public.merge_tags($1,$2,$3)', [
      second,
      tagId,
      'These pins document the same surface',
    ]);
    const result = (await db.query<{ tag: any }>('select public.read_tag($1) as tag', [tagId]))
      .rows[0].tag;
    assert.equal(result.photos.length, 3);
    assert.equal(result.artworks.length, 2);
    await login(null);
    assert.equal(
      (await db.query<{ tag: any }>('select public.read_tag($1) as tag', [second])).rows[0].tag,
      null,
    );
  });
  await t.test('likes are unique per account and collections and saves remain private', async () => {
    const collectionId = randomUUID();
    const change = async (action: object) => (await db.query<any>('select public.change_social($1) as data', [action])).rows[0].data;
    await login(user);
    await change({ kind: 'like', artworkId, enabled: true });
    await change({ kind: 'like', artworkId, enabled: true });
    await change({ kind: 'create', collectionId, name: 'Zagreb favourites' });
    await change({ kind: 'membership', collectionId, artworkId, enabled: true });
    await login(other);
    let social = await change({ kind: 'like', artworkId, enabled: true });
    assert.equal(social.counts[artworkId], 2);
    assert.equal(social.collections.length, 0);
    assert.equal(social.pieces.length, 0);
    assert.equal((await db.query('select * from public.graffiti_collections')).rows.length, 0);
    for (const kind of ['rename', 'delete', 'membership']) {
      await assert.rejects(change({ kind, collectionId, artworkId, name: 'Stolen', enabled: true }), /no longer exists/);
    }
    await login(null);
    social = (await db.query<any>('select public.read_social() as data')).rows[0].data;
    assert.equal(social.counts[artworkId], 2);
    assert.deepEqual(social.liked, []);
    assert.deepEqual(social.collections, []);
    await assert.rejects(change({ kind: 'like', artworkId, enabled: true }), /permission denied/);
    await login(user);
    social = await change({ kind: 'like', artworkId, enabled: false });
    assert.equal(social.counts[artworkId], 1);
    assert.equal(social.pieces[0].tagId, tagId);
    social = await change({ kind: 'membership', collectionId, artworkId, enabled: false });
    assert.equal(social.pieces.length, 1);
    await change({ kind: 'membership', collectionId, artworkId, enabled: true });
    social = await change({ kind: 'save', artworkId, enabled: false });
    assert.equal(social.pieces.length, 0);
    assert.deepEqual(social.collections[0].artworkIds, []);
    await change({ kind: 'membership', collectionId, artworkId, enabled: true });
    social = await change({ kind: 'delete', collectionId });
    assert.equal(social.pieces.length, 1);
  });
  await t.test('hidden tags disappear from anonymous reads', async () => {
    await login(user);
    await db.query('select public.hide_tag($1,$2)', [
      tagId,
      'Reviewing a report about this location',
    ]);
    await login(null);
    assert.equal((await db.query('select * from public.tags')).rows.length, 0);
    assert.equal((await db.query('select * from public.photos')).rows.length, 0);
  });
  await t.test('multiple artwork categories survive contribution and correction; invalid lists are rejected', async () => {
    await login(user);
    const p = await payload(user);
    Object.assign(p.artwork, { kinds: ['Piece', 'Stencil'] });
    const result = await db.query<{ id: string }>('select public.add_contribution($1) as id', [p]);
    const id = result.rows[0].id;
    const read = async () => (await db.query<{ tag: any }>('select public.read_tag($1) as tag', [id])).rows[0].tag;
    let saved = await read();
    assert.deepEqual(saved.artworks[0].kinds, ['Piece', 'Stencil']);
    const photo = saved.photos[0];
    const changes = { photoId: photo.id, artworkTitle: 'Layered wall', artist: 'Me', kind: 'Mural', kinds: ['Mural', 'Stencil'], year: photo.year, takenOn: photo.takenOn, precision: photo.precision, condition: photo.condition, caption: photo.caption, photographer: photo.photographer };
    await db.query('select public.edit_record($1,$2,$3,$4,$5)', [id, photo.id, saved.revision, changes, 'Correct categories']);
    saved = await read();
    assert.deepEqual(saved.artworks[0].kinds, ['Mural', 'Stencil']);
    for (const kinds of [[], ['Mural', 'Bogus'], ['Mural', 'Mural'], ['Stencil']]) {
      await assert.rejects(db.query('select public.edit_record($1,$2,$3,$4,$5)', [id, photo.id, saved.revision, { ...changes, kinds }, 'Invalid categories']));
    }
    assert.deepEqual((await read()).artworks[0].kinds, ['Mural', 'Stencil']);
    await login(null);
    assert.deepEqual((await read()).artworks[0].kinds, ['Mural', 'Stencil']);
  });
  await db.close();
});
