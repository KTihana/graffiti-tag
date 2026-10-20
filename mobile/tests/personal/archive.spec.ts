import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

test('private archive: camera entry, GPS, photo, backup recovery, and offline editing', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 45.807, longitude: 15.978 });
  await page.goto('/');
  await expect(page.getByText('MY PRIVATE ARCHIVE', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open The railway wall', exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  const cameraChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  const chooser = await cameraChooser;
  expect(await chooser.element().getAttribute('capture')).not.toBeNull();
  await chooser.setFiles(path.join(process.cwd(), 'assets/demo/wall-3.jpg'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('button', { name: 'Use my location as a starting point', exact: true })
    .click();
  await expect(page.getByText('45.80700, 15.97800', { exact: true })).toBeVisible();
  await page.getByLabel('Wall name', { exact: true }).fill('My first personal wall');
  await page.getByRole('checkbox', { name: 'Confirm wall location', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Year', exact: true }).click();
  await page.getByLabel('Photo year', { exact: true }).fill('2010');
  await page
    .getByLabel('The story (optional)')
    .fill('Photographed before this wall was painted over.');
  await expect(
    page.getByRole('checkbox', { name: 'Confirm photo sharing permission' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Save photograph', exact: true }).click();
  await expect(page).toHaveURL(/\/tag\/[a-f0-9-]+$/);
  const tagPath = new URL(page.url()).pathname;
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await page.getByRole('button', { name: 'Like Untitled', exact: true }).click();
  await page.getByRole('button', { name: 'Save piece', exact: true }).click();
  await page.getByLabel('Collection name', { exact: true }).fill('My favourite walls');
  await page.getByRole('button', { name: 'Create collection', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'My favourite walls', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await expect(
    page.getByText('My first personal wall', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.goto('/account');
  await expect(page.getByText('1 tags · 1 photos', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await download;
  const file = test.info().outputPath('personal-backup.json');
  await backup.saveAs(file);
  const json = JSON.parse(await fs.readFile(file, 'utf8'));
  const original = await fs.readFile(path.join(process.cwd(), 'assets/demo/wall-3.jpg'));
  const entry = Object.values(json.media)[0] as { originalBase64: string };
  expect(Buffer.from(entry.originalBase64, 'base64')).toEqual(original);
  expect(json.savedIds).toHaveLength(1);
  expect(json.social.collections[0].name).toBe('My favourite walls');
  expect(json.social.pieces).toHaveLength(1);
  expect(json.social.liked).toHaveLength(1);
  await page.screenshot({ path: 'artifacts/personal-account-phone.png', fullPage: true });

  const recoveredContext = await browser.newContext({
    baseURL,
    viewport: { width: 412, height: 915 },
  });
  const recovered = await recoveredContext.newPage();
  recovered.on('pageerror', (e) => errors.push(e.message));
  await recovered.goto('/account');
  await expect(recovered.getByText('0 tags · 0 photos', { exact: true })).toBeVisible();
  const importChooser = recovered.waitForEvent('filechooser');
  await recovered.getByRole('button', { name: 'Import backup', exact: true }).click();
  await (await importChooser).setFiles(file);
  await expect(
    recovered.getByText('Imported 1 tags. 0 existing tags were kept as they are.', { exact: true }),
  ).toBeVisible();
  await recovered.goto(tagPath);
  await expect(
    recovered.getByText('My first personal wall', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(recovered.getByRole('button', { name: 'Unsave tag', exact: true })).toBeVisible();
  await expect(recovered.getByRole('button', { name: 'Unlike Untitled', exact: true })).toContainText('1 like');
  await recovered.goto('/collection');
  await recovered.getByRole('button', { name: 'My favourite walls (1)', exact: true }).click();
  await expect(recovered.getByRole('button', { name: 'Open piece Untitled', exact: true })).toBeVisible();
  await recovered.goto(tagPath);
  await recovered.waitForFunction(() =>
    [...document.images].some((image) => image.src.startsWith('blob:') && image.naturalWidth > 0),
  );
  await recovered.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await recoveredContext.setOffline(true);
  await recovered.reload();
  await expect(
    recovered.getByText('My first personal wall', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await recovered.waitForFunction(() =>
    [...document.images].some((image) => image.src.startsWith('blob:') && image.naturalWidth > 0),
  );
  await recovered.getByRole('button', { name: 'Edit this tag', exact: true }).click();
  await recovered.getByLabel('Wall name', { exact: true }).fill('My personal wall edited offline');
  await recovered
    .getByLabel('What changed, and why?')
    .fill('Clarified the wall name while offline.');
  await recovered.getByRole('button', { name: 'Save local edit', exact: true }).click();
  await expect(
    recovered
      .getByText('My personal wall edited offline', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await recovered.goto('/account');
  const repeat = recovered.waitForEvent('filechooser');
  await recovered.getByRole('button', { name: 'Import backup', exact: true }).click();
  await (await repeat).setFiles(file);
  await expect(
    recovered.getByText('Imported 0 tags. 1 existing tags were kept as they are.', { exact: true }),
  ).toBeVisible();
  await recovered.goto(tagPath);
  await expect(
    recovered
      .getByText('My personal wall edited offline', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await recoveredContext.close();
  expect(errors).toEqual([]);
});
