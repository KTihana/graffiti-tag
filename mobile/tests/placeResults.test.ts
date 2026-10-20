import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordinatePlace, parsePlaces, searchOpenPlaces, PLACE_SEARCH_TIMEOUT, normalizePlaceQuery } from '../src/services/placeSearch';
const city = { properties: { name: 'Osijek', osm_value: 'city', country: 'Hrvatska', extent: [18.596, 45.580, 18.781, 45.514] }, geometry: { coordinates: [18.695, 45.555] } };
const address = { properties: { name: 'Museum', street: 'Ilica', housenumber: '10', city: 'Zagreb', country: 'Hrvatska' }, geometry: { coordinates: [15.97, 45.81] } };

test('towns fit their area, while specific places zoom to their location', () => {
  const results = parsePlaces({ features: [city, address, address, { geometry: { coordinates: [200, 95] } }] }, 'query');
  assert.equal(results.length, 2);
  assert.equal(results[0].title, 'Osijek');
  assert.equal(results[1].address, 'Ilica 10, Zagreb, Hrvatska');
  assert.ok(results[0].viewport.longitudeDelta > 0.2);
  assert.equal(results[1].viewport.longitudeDelta, 0.004);
  assert.ok(Math.abs(results[0].viewport.latitude - 45.547) < 0.0001);
});
test('coordinates work offline and invalid coordinates have actionable errors', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const result = await searchOpenPlaces('45.555, 18.695');
  assert.equal(result[0].latitude, 45.555);
  assert.equal(result[0].longitude, 18.695);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(coordinatePlace('Osijek'), null);
  assert.throws(() => coordinatePlace('91, 18'), /Coordinates must/);
});
test('slow valid searches survive the previous 12 second cutoff', async (t) => {
  assert.equal(PLACE_SEARCH_TIMEOUT, 30000);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    setTimeout(() => resolve(Response.json({ features: [city] })), 17000);
  }));
  const result = searchOpenPlaces('slow valid city');
  t.mock.timers.tick(17001);
  assert.equal((await result)[0].title, 'Osijek');
});

test('normalizes a street number and town without altering city or coordinate queries', () => {
  assert.equal(normalizePlaceQuery(' Ilica 10 Zagreb '), 'Ilica 10, Zagreb');
  assert.equal(normalizePlaceQuery('Vukovarska ulica 12a Osijek'), 'Vukovarska ulica 12a, Osijek');
  assert.equal(normalizePlaceQuery('Ilica 10, Zagreb'), 'Ilica 10, Zagreb');
  assert.equal(normalizePlaceQuery('Trg bana Josipa Jelačića Zagreb'), 'Trg bana Josipa Jelačića Zagreb');
  assert.equal(normalizePlaceQuery('Osijek'), 'Osijek');
});

test('house-number queries use structured street, number, and town parameters', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const request = new URL(url);
    assert.equal(request.pathname, '/structured');
    assert.equal(request.searchParams.get('street'), 'Ilica');
    assert.equal(request.searchParams.get('housenumber'), '10');
    assert.equal(request.searchParams.get('city'), 'Zagreb');
    assert.equal(request.searchParams.has('q'), false);
    return Response.json({ features: [{ properties: { street: 'Ilica', housenumber: '10', city: 'Zagreb' }, geometry: { coordinates: [15.9742331, 45.813386] } }] });
  });
  const result = (await searchOpenPlaces('Ilica 10 Zagreb'))[0];
  assert.equal(result.title, 'Ilica 10');
  assert.equal(result.longitude, 15.9742331);
});

test('an unmatched house number never silently selects another part of the street', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ features: [{ properties: { name: 'Ilica', type: 'street', city: 'Zagreb' }, geometry: { coordinates: [15.92, 45.81] } }] }));
  await assert.rejects(searchOpenPlaces('Ilica 999999 Zagreb'), /No matching house number found/);
});
