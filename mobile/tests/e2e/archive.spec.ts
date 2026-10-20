import { test, expect } from '@playwright/test';
import path from 'node:path';

test('browse, filter, bookmark, edit, and restore a wall', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('LOCAL DEMO · NOT PUBLIC')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open The railway wall', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/explore-phone.png' });
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Year photographed').fill('2018');
  await page.getByRole('button', { name: 'Show tags', exact: true }).click();
  await page.getByRole('button', { name: 'Open The railway wall', exact: true }).click();
  await expect(page.getByText('c. 2018', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unsave tag', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/wall-history-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Edit this tag', exact: true }).click();
  await page.getByLabel('Wall name', { exact: true }).fill('Railway wall — east side');
  await page.getByLabel('What changed, and why?').fill('Clarified which side of the wall this is.');
  await page.getByRole('button', { name: 'Save local edit', exact: true }).click();
  await expect(
    page.getByText('Railway wall — east side', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit history', exact: true }).click();
  await expect(
    page.getByText('Clarified which side of the wall this is.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restore previous wall details', exact: true }).click();
  await expect(page.getByText('Previous wall details restored.', { exact: false })).toBeVisible();
  await page.goto('/collection');
  await expect(page.getByText('The railway wall', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('The railway wall', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('upload an old photograph, preserve it after reload, and submit and resolve a report', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tag/demo-1');
  await page.getByRole('button', { name: 'Add to this wall’s history', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles(path.join(process.cwd(), 'assets/demo/wall-2.jpg'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('ADDING TO AN EXISTING TAG', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('button', { name: 'Chromatic letters · Unknown artist', exact: true })
    .click();
  await page.getByLabel('Photo year', { exact: true }).fill('2007');
  await page.getByLabel('The story (optional)').fill('Found in a box of photographs from 2007.');
  await page
    .getByRole('checkbox', { name: 'Confirm photo sharing permission', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save to local demo', exact: true }).click();
  await expect(page).toHaveURL(/\/tag\/demo-1$/);
  await expect(
    page
      .getByText('Found in a box of photographs from 2007.', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByText('Found in a box of photographs from 2007.', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page
    .getByLabel('What should we review?')
    .fill('This wall may be the same as another nearby tag.');
  await page.getByRole('button', { name: 'Save demo report', exact: true }).click();
  await expect(
    page.getByText('Report saved to the local demo moderation queue.', { exact: false }),
  ).toBeVisible();
  await page.goto('/moderate');
  await expect(
    page.getByText('This wall may be the same as another nearby tag.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mark resolved', exact: true }).click();
  await expect(page.getByText('No open reports.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('map search, empty filters, and desktop layout remain usable', async ({ page }) => {
  await page.route('https://photon.komoot.io/api/**', (route) => {
    const berlin = new URL(route.request().url()).searchParams.get('q') === 'Berlin';
    return route.fulfill({ json: { features: [{
      properties: { name: berlin ? 'Berlin' : 'Zagreb', osm_value: 'city' },
      geometry: { coordinates: berlin ? [13.4, 52.52] : [15.98, 45.81] },
    }] } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Year photographed').fill('1950');
  await page.getByRole('button', { name: 'Show tags', exact: true }).click();
  await expect(
    page.getByText('There are stories here waiting to be saved.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'All tags', exact: true }).click();
  await page.getByLabel('Search archive or city').fill('Berlin');
  await page.getByLabel('Search archive or city').press('Enter');
  await expect(page.getByLabel('Search archive or city')).toHaveValue('');
  await expect(
    page.getByText('There are stories here waiting to be saved.', { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Search archive or city').fill('Zagreb');
  await page.getByLabel('Search archive or city').press('Enter');
  await expect(
    page.getByRole('button', { name: 'Open The railway wall', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/explore-desktop.png' });
});

test('create a new wall with an unknown date, correct attribution, and restore it', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles(path.join(process.cwd(), 'assets/demo/wall-3.jpg'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Wall name', { exact: true }).fill('A newly archived wall');
  await page.getByRole('checkbox', { name: 'Confirm wall location', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Unknown', exact: true }).click();
  await page.getByRole('button', { name: 'Save to local demo', exact: true }).click();
  await expect(
    page.getByText('Confirm that you can share this photograph.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Confirm photo sharing permission', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save to local demo', exact: true }).click();
  await expect(page).toHaveURL(/\/tag\/[a-f0-9-]+$/);
  await expect(
    page.getByText('A newly archived wall', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Correct photo or artwork details', exact: true }).click();
  await page.getByLabel('Artist or alias', { exact: true }).fill('A known artist');
  await page
    .getByLabel('What changed, and why?')
    .fill('The photographer confirmed this attribution.');
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(
    page.getByText('A known artist · Piece', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit history', exact: true }).click();
  await page.getByRole('button', { name: 'Restore previous photo details', exact: true }).click();
  await expect(page.getByText('Previous photo details restored.', { exact: false })).toBeVisible();
});
