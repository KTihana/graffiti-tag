import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateLabel,
  distanceMeters,
  inViewport,
  matches,
  orderedPhotos,
  validateContribution,
} from '../src/domain';
import { demoTags } from '../src/data/demo';
import type { Contribution } from '../src/types';
const contribution: Contribution = {
  title: 'East wall',
  description: '',
  point: { latitude: 45, longitude: 15 },
  artworkTitle: 'Untitled',
  artist: '',
  kind: 'Piece',
  imageUri: 'file://image.jpg',
  mimeType: 'image/jpeg',
  year: '2007',
  takenOn: '',
  precision: 'year',
  condition: 'present',
  caption: '',
  photographer: '',
  rightsConfirmed: true,
};
test('historical years and unknown dates are supported without inventing a date', () => {
  assert.equal(validateContribution(contribution), null);
  assert.equal(validateContribution({ ...contribution, year: '', precision: 'unknown' }), null);
  assert.equal(dateLabel({ precision: 'approximate', year: 2007, takenOn: null }), 'c. 2007');
});
test('future dates, impossible dates, inconsistent years, and missing permission are rejected', () => {
  for (const override of [
    { year: '3000' },
    { year: '' },
    { year: '2019', takenOn: '2019-02-29', precision: 'exact' },
    { year: '2007', takenOn: '2008-01-01', precision: 'exact' },
    { rightsConfirmed: false },
    { point: { latitude: NaN, longitude: 0 } },
  ])
    assert.ok(validateContribution({ ...contribution, ...override } as Contribution));
});
test('leap dates are accepted', () =>
  assert.equal(
    validateContribution({
      ...contribution,
      year: '2020',
      takenOn: '2020-02-29',
      precision: 'exact',
    }),
    null,
  ));
test('timelines use photographed year rather than upload time; unknown dates come last', () => {
  const p = demoTags[0].photos;
  const unknown = {
    ...p[0],
    id: 'unknown',
    year: null,
    precision: 'unknown' as const,
    uploadedAt: '2099-01-01T00:00:00Z',
  };
  assert.deepEqual(
    orderedPhotos([p[2], unknown, p[0], p[1]]).map((x) => x.year),
    [2026, 2023, 2018, null],
  );
});
test('viewport matching wraps across the international date line', () => {
  assert.ok(
    inViewport(
      { latitude: 0, longitude: -179.9 },
      { latitude: 0, longitude: 179.9, latitudeDelta: 2, longitudeDelta: 2 },
    ),
  );
  assert.ok(
    !inViewport(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 179.9, latitudeDelta: 2, longitudeDelta: 2 },
    ),
  );
});
test('filters match the photograph belonging to the chosen artwork', () => {
  const t = structuredClone(demoTags[0]);
  t.artworks[1].kind = 'Mural';
  assert.ok(matches(t, '', ['Mural'], '2018'));
  assert.ok(!matches(t, '', ['Mural'], '2026'));
  assert.ok(matches(t, 'railway', [], ''));
});
test('nearby duplicate suggestions use real distances', () => {
  assert.equal(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(
    Math.abs(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 }) - 111.19,
    ) < 1,
  );
});

// Dates describe the photographer's local calendar day, even before midnight UTC.
test('today is valid just after local midnight', () => {
  assert.equal(
    validateContribution(
      { ...contribution, precision: 'exact', year: '2026', takenOn: '2026-01-01' },
      new Date(2026, 0, 1, 0, 15),
    ),
    null,
  );
});


test('multiple artwork types match either selection and keep photo/year associations', () => {
  const mural = structuredClone(demoTags[1]);
  const stencil = structuredClone(demoTags[2]);
  const piece = structuredClone(demoTags[4]);
  assert.ok(matches(mural, '', ['Mural', 'Stencil'], ''));
  assert.ok(matches(stencil, '', ['Mural', 'Stencil'], ''));
  assert.ok(!matches(piece, '', ['Mural', 'Stencil'], ''));
  assert.ok(matches(piece, '', [], ''));
  const mixed = structuredClone(demoTags[0]);
  mixed.artworks[0].kind = 'Piece';
  mixed.artworks[1].kind = 'Mural';
  assert.ok(matches(mixed, '', ['Mural', 'Stencil'], '2018'));
  assert.ok(!matches(mixed, '', ['Mural', 'Stencil'], '2026'));
  assert.ok(!matches(mural, 'does not exist', ['Mural', 'Stencil'], ''));
});


test('each category of an artwork is searchable and empty or invalid selections are rejected', () => {
  const tag = structuredClone(demoTags[1]);
  tag.artworks[0].kinds = ['Mural', 'Stencil'];
  assert.ok(matches(tag, '', ['Stencil'], ''));
  assert.ok(matches(tag, '', ['Mural'], ''));
  assert.ok(!matches(tag, '', ['Lettering'], ''));
  assert.equal(validateContribution({ ...contribution, kinds: ['Piece', 'Stencil'] }), null);
  assert.match(validateContribution({ ...contribution, kinds: [] })!, /category/);
  assert.match(validateContribution({ ...contribution, kinds: ['Piece', 'Piece'] })!, /category/);
});
