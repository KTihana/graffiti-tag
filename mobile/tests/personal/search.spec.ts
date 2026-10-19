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
  const error = page.getByText('No place found. Try a city and country.', { exact: true });
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
  await page.goto('/');
  await page.getByLabel('Search archive or city').fill('Osijek');
  const request = page.waitForRequest('https://photon.komoot.io/api/**');
  await page.getByLabel('Search archive or city').press('Enter');
  await request;
  await page.getByLabel('Search archive or city').fill('Rijeka');
  release();
  await page.waitForTimeout(500);
  await expect(page.getByLabel('Search archive or city')).toHaveValue('Rijeka');
});
