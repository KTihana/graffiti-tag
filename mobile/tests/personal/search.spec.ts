import { test, expect } from '@playwright/test';

const osijek = { features: [{ geometry: { coordinates: [18.6953685, 45.5548793] } }] };

test('Osijek search moves the map and the add-tag starting location', async ({ page }) => {
  await page.route('https://photon.komoot.io/api/**', (route) => route.fulfill({ json: osijek }));
  await page.goto('/');
  await page.getByLabel('Search archive or city').fill('Osijek');
  await page.getByText('Find “Osijek” on the map', { exact: true }).click();
  await expect(page.getByLabel('Search archive or city')).toHaveValue('');
  // Allow the map animation to finish before using its viewport as a new tag location.
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  await expect(page).toHaveURL(/lat=45\.55\d+&lng=18\.69\d+/);
});

test('search errors survive archive refreshes and can be retried', async ({ page }) => {
  let success = false;
  await page.route('https://photon.komoot.io/api/**', (route) => route.fulfill({
    json: success ? osijek : { features: [] },
  }));
  await page.goto('/');
  await page.getByLabel('Search archive or city').fill('Osijek');
  await page.getByLabel('Search archive or city').press('Enter');
  const error = page.getByText('No place found. Try adding the town or country, or enter coordinates.', { exact: true });
  await expect(error).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.waitForTimeout(1800);
  await expect(error).toBeVisible();
  success = true;
  await page.getByLabel('Search archive or city').press('Enter');
  await expect(page.getByLabel('Search archive or city')).toHaveValue('');
  await expect(error).toHaveCount(0);
});

test('editing the query ignores the previous response', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    await wait;
    await route.fulfill({ json: osijek });
  });
  try {
    await page.goto('/');
    await page.getByLabel('Search archive or city').fill('Osijek');
    const request = page.waitForRequest('https://photon.komoot.io/api/**');
    await page.getByLabel('Search archive or city').press('Enter');
    await request;
    await page.getByLabel('Search archive or city').fill('Rijeka');
    release();
    await page.waitForTimeout(500);
    await expect(page.getByLabel('Search archive or city')).toHaveValue('Rijeka');
  } finally { release(); }
});

const candidates = { features: [
  { properties: { name: 'Osijek', osm_id: 1, osm_value: 'city', country: 'Hrvatska', extent: [18.596, 45.580, 18.781, 45.514] }, geometry: { coordinates: [18.695, 45.555] } },
  { properties: { name: 'Osijek station', osm_id: 2, osm_value: 'station', street: 'Trg Lavoslava Ružičke', city: 'Osijek', country: 'Hrvatska' }, geometry: { coordinates: [18.683, 45.552] } },
] };
test('town search shows choices, fits the town, and a specific result gets its own map pin', async ({ page }) => {
  let calls = 0;
  await page.route('https://photon.komoot.io/api/**', (route) => { calls++; return route.fulfill({ json: candidates }); });
  await page.goto('/');
  await page.getByLabel('Search archive or city').fill('Osijek');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Search places', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search result: Osijek', exact: true })).toBeVisible();
  await expect(page.getByText('Choose a place', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/place-choices.png' });
  await page.getByRole('button', { name: 'Show Osijek station, Trg Lavoslava Ružičke, Osijek, Hrvatska on map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search result: Osijek station', exact: true })).toBeVisible();
  await expect(page.getByText('Choose a place', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  await expect(page).toHaveURL(/lat=45\.552\d*&lng=18\.68\d+/);
});
test('coordinates search moves the map without an internet request', async ({ page }) => {
  await page.route('https://photon.komoot.io/api/**', (route) => route.abort());
  await page.goto('/');
  await page.getByLabel('Search archive or city').fill('45.555, 18.695');
  await page.getByLabel('Search archive or city').press('Enter');
  await expect(page.getByRole('button', { name: 'Search result: 45.55500, 18.69500', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear location result', exact: true }).click();
  await expect(page.locator('.search-place-pin')).toHaveCount(0);
});

test('street number and town search finds the building, not another road segment', async ({ page }) => {
  await page.route('https://photon.komoot.io/structured**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('street')).toBe('Ilica');
    expect(params.get('housenumber')).toBe('10');
    expect(params.get('city')).toBe('Zagreb');
    return route.fulfill({ json: { features: [{ properties: { street: 'Ilica', housenumber: '10', city: 'Zagreb' }, geometry: { coordinates: [15.9742331, 45.813386] } }] } });
  });
  await page.goto('/');
  await page.getByLabel('Search archive or city').fill('Ilica 10 Zagreb');
  await page.getByRole('button', { name: 'Search places', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search result: Ilica 10', exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  await expect(page).toHaveURL(/lat=45\.813\d+&lng=15\.974\d+/);
});
