import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeSocial, emptySocial, validateSocialBackup, mergeSocialBackup } from '../src/services/socialModel';

test('likes are idempotent and independent of saved pieces', () => {
  let data = changeSocial(emptySocial(), { kind: 'like', artworkId: 'art', enabled: true });
  data = changeSocial(data, { kind: 'like', artworkId: 'art', enabled: true });
  assert.equal(data.counts.art, 1);
  assert.equal(data.pieces.length, 0);
  data = changeSocial(data, { kind: 'like', artworkId: 'art', enabled: false });
  assert.equal(data.counts.art, 0);
});
test('pieces can belong to multiple collections; unsaving clears memberships', () => {
  let data = emptySocial();
  for (const id of ['one', 'two']) {
    data = changeSocial(data, { kind: 'create', collectionId: id, name: id });
    data = changeSocial(data, { kind: 'membership', collectionId: id, artworkId: 'art', tagId: 'wall', enabled: true });
  }
  assert.equal(data.pieces.length, 1);
  data = changeSocial(data, { kind: 'membership', collectionId: 'one', artworkId: 'art', enabled: false });
  assert.equal(data.pieces.length, 1);
  assert.deepEqual(data.collections[1].artworkIds, ['art']);
  data = changeSocial(data, { kind: 'save', artworkId: 'art', enabled: false });
  assert.equal(data.pieces.length, 0);
  assert.ok(data.collections.every((c) => !c.artworkIds.length));
});
test('collection names validate and deleting a collection keeps saved pieces', () => {
  let data = changeSocial(emptySocial(), { kind: 'create', collectionId: 'one', name: ' Zagreb ' });
  assert.throws(() => changeSocial(data, { kind: 'create', collectionId: 'two', name: 'zagreb' }), /already have/);
  assert.throws(() => changeSocial(data, { kind: 'rename', collectionId: 'one', name: ' ' }), /between/);
  data = changeSocial(data, { kind: 'membership', collectionId: 'one', artworkId: 'art', tagId: 'wall', enabled: true });
  data = changeSocial(data, { kind: 'delete', collectionId: 'one' });
  assert.equal(data.pieces.length, 1);
});

test('backup social data checks references and merges without changing existing preferences', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  let incoming = changeSocial(emptySocial(), { kind: 'create', collectionId: id, name: 'Zagreb' });
  incoming = changeSocial(incoming, { kind: 'membership', collectionId: id, artworkId: 'art', tagId: 'wall', enabled: true });
  incoming = changeSocial(incoming, { kind: 'like', artworkId: 'art', enabled: true });
  validateSocialBackup(incoming, new Map([['art', 'wall']]));
  assert.throws(() => validateSocialBackup(incoming, new Map()), /invalid likes or collections/);
  const restored = mergeSocialBackup(emptySocial(), incoming, new Set(['art']));
  assert.equal(restored.pieces.length, 1);
  assert.equal(restored.counts.art, 1);
  const removed = changeSocial(restored, { kind: 'save', artworkId: 'art', enabled: false });
  assert.equal(mergeSocialBackup(removed, incoming, new Set()).pieces.length, 0);
});
