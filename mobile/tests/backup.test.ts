import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePersonalBackup } from '../src/services/backupFormat';
import type { PersonalBackup } from '../src/services/backupFormat';

const tagId = '10000000-0000-4000-8000-000000000001';
const artworkId = '20000000-0000-4000-8000-000000000002';
const photoId = '30000000-0000-4000-8000-000000000003';
const revisionId = '40000000-0000-4000-8000-000000000004';
const media = {
  [photoId]: {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    originalBase64: 'AQIDBA==',
    previewBase64: 'BQYHCA==',
  },
};
function validBackup(): PersonalBackup {
  return {
    format: 'graffiti-tag-personal-backup',
    version: 1,
    createdAt: '2026-10-18T12:00:00.000Z',
    archive: {
      tags: [
        {
          id: tagId,
          title: 'North wall',
          description: 'A painted wall.',
          latitude: 45.8,
          longitude: 15.9,
          artworks: [{ id: artworkId, title: 'Untitled', artist: 'Unknown artist', kind: 'Piece' }],
          photos: [
            {
              id: photoId,
              artworkId,
              uri: `idb:${photoId}`,
              year: 2020,
              takenOn: null,
              precision: 'year',
              condition: 'present',
              caption: '',
              photographer: 'Me',
              contributor: 'Me',
              uploadedAt: '2026-10-18T12:00:00.000Z',
            },
          ],
          revision: 1,
          createdAt: '2026-10-18T12:00:00.000Z',
        },
      ],
      revisions: [
        {
          id: revisionId,
          tagId,
          actor: 'Me',
          action: 'Added a photograph',
          createdAt: '2026-10-18T12:00:00.000Z',
          before: null,
          after: {
            title: 'North wall',
            description: 'A painted wall.',
            latitude: 45.8,
            longitude: 15.9,
          },
          version: 1,
        },
      ],
      reports: [],
    },
    savedIds: [tagId],
    media,
  } as PersonalBackup;
}

test('accepts a complete personal backup with a linked local photo and revision', () => {
  assert.equal(validatePersonalBackup(validBackup()).archive.tags.length, 1);
});

test('rejects missing photo fields, invalid artwork kinds, and malformed revision snapshots', () => {
  const missingPhotoField = validBackup();
  delete (missingPhotoField.archive.tags[0].photos[0] as unknown as Record<string, unknown>).precision;
  assert.throws(() => validatePersonalBackup(missingPhotoField), /invalid tag/i);

  const badArtwork = validBackup();
  badArtwork.archive.tags[0].artworks[0].kind = 'Unknown' as never;
  assert.throws(() => validatePersonalBackup(badArtwork), /invalid tag/i);

  const badRevision = validBackup();
  badRevision.archive.revisions[0].after = { title: 'Missing coordinates' } as never;
  assert.throws(() => validatePersonalBackup(badRevision), /invalid revision/i);
});

test('rejects non-local image URIs and backups without both image files', () => {
  for (const uri of ['https://example.com/photo.jpg', 'blob:https://example.com/photo', 'file:///photo.jpg']) {
    const remotePhoto = validBackup();
    remotePhoto.archive.tags[0].photos[0].uri = uri;
    assert.throws(() => validatePersonalBackup(remotePhoto), /invalid tag/i);
  }

  const noOriginal = validBackup();
  noOriginal.media[photoId].originalBase64 = '';
  assert.throws(() => validatePersonalBackup(noOriginal), /original image data/i);

  const noMedia = validBackup();
  noMedia.media = {};
  assert.throws(() => validatePersonalBackup(noMedia), /missing image files/i);
});

test('rejects invalid dates, out-of-range coordinates, and inherited or prototype media keys', () => {
  const badDate = validBackup();
  badDate.archive.tags[0].photos[0].takenOn = '2020-02-30';
  badDate.archive.tags[0].photos[0].precision = 'exact';
  assert.throws(() => validatePersonalBackup(badDate), /invalid tag/i);

  const badCoordinate = validBackup();
  badCoordinate.archive.tags[0].latitude = 91;
  assert.throws(() => validatePersonalBackup(badCoordinate), /invalid tag/i);

  const prototypeMedia = validBackup();
  prototypeMedia.media = JSON.parse(`{"__proto__":{},"${photoId}":${JSON.stringify(media[photoId])}}`);
  assert.throws(() => validatePersonalBackup(prototypeMedia), /missing image files/i);

  const inheritedMedia = validBackup();
  inheritedMedia.media = Object.create({ [photoId]: media[photoId] });
  assert.throws(() => validatePersonalBackup(inheritedMedia), /missing image files/i);
});
