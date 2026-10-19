import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findOpenPlace } from '../src/services/placeSearch';

test('place lookup encodes queries, converts coordinates, and caches results', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls++;
    assert.equal(new URL(url).searchParams.get('q'), 'Osijek');
    return Response.json({ features: [{ geometry: { coordinates: [18.695, 45.555] } }] });
  });
  assert.deepEqual(await findOpenPlace(' Osijek '), { latitude: 45.555, longitude: 18.695 });
  assert.deepEqual(await findOpenPlace('osijek'), { latitude: 45.555, longitude: 18.695 });
  assert.equal(calls, 1);
});

test('empty results and service failures have readable errors and can be retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ features: [] }));
  await assert.rejects(findOpenPlace('unknown town'), /No place found/);
  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(findOpenPlace('unknown town'), /Check your internet/);
  fetch.mock.mockImplementation(async () => new Response('', { status: 429 }));
  await assert.rejects(findOpenPlace('unknown town'), /Place search is unavailable/);
  fetch.mock.mockImplementation(async () => Response.json({ features: [{ geometry: { coordinates: [181, 91] } }] }));
  await assert.rejects(findOpenPlace('unknown town'), /Place search is unavailable/);
  fetch.mock.mockImplementation(async () => Response.json({ features: [{ geometry: { coordinates: [16, 46] } }] }));
  assert.deepEqual(await findOpenPlace('unknown town'), { latitude: 46, longitude: 16 });
});

test('duplicate in-flight lookups share a request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ features: [] }));
  await Promise.allSettled([findOpenPlace('duplicate'), findOpenPlace('duplicate')]);
  assert.equal(fetch.mock.callCount(), 1);
});
