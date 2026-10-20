import { test, expect } from '@playwright/test';
import path from 'node:path';

test('holding the map vibrates, drops a draft pin, and opens a contribution at that point', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', { value: (duration: number) => {
      const target = window as Window & { vibrations?: number[] };
      (target.vibrations ??= []).push(duration);
      return true;
    } });
  });
  await page.goto('/');
  await expect(page.getByText('LOCAL DEMO · NOT PUBLIC')).toBeVisible();
  const map = page.locator('.leaflet-container');
  await expect(map).toBeVisible();
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect(page.getByAltText('New tag location')).toBeVisible();
  await page.mouse.up();
  await expect(page).toHaveURL(/\/contribute\?.*placed=1/);
  await expect(page.getByText('YOUR TAG LOCATION')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose photo', exact: true })).toBeVisible();
  const point = new URL(page.url()).searchParams;
  const lat = Number(point.get('lat')), lng = Number(point.get('lng'));
  expect(Number.isFinite(lat) && Number.isFinite(lng)).toBe(true);
  expect(await page.evaluate(() => (window as Window & { vibrations?: number[] }).vibrations)).toEqual([40]);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles(path.join(process.cwd(), 'assets/demo/wall-3.jpg'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Confirm wall location' })).toBeChecked();
  await page.getByLabel('Wall name', { exact: true }).fill('Wall placed by holding the map');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Artist or alias (optional)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unknown', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Confirm photo sharing permission', exact: true }).click();
  await page.getByRole('button', { name: 'Save to local demo', exact: true }).click();
  await expect(page).toHaveURL(/\/tag\/[a-f0-9-]+$/);
  await expect(page.getByText('Wall placed by holding the map', { exact: true }).filter({ visible: true })).toBeVisible();
  const storedPoint = await page.evaluate(() => {
    const archive = JSON.parse(localStorage.getItem('graffiti-tag-demo-v1')!);
    const tag = archive.tags.find((tag: { title: string }) => tag.title === 'Wall placed by holding the map');
    return { latitude: tag.latitude, longitude: tag.longitude };
  });
  expect(storedPoint).toEqual({ latitude: lat, longitude: lng });
});

test('a tap or a map drag does not start a contribution', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LOCAL DEMO · NOT PUBLIC')).toBeVisible();
  const map = page.locator('.leaflet-container');
  const box = (await map.boundingBox())!;
  const x = box.x + box.width * 0.3, y = box.y + box.height * 0.5;
  await page.mouse.click(x, y);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/\/$/);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 30, { steps: 5 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByAltText('New tag location')).toHaveCount(0);
});

test('touch holds work and interrupted or multi-touch gestures are cancelled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LOCAL DEMO · NOT PUBLIC')).toBeVisible();
  const map = page.locator('.leaflet-container');
  const box = (await map.boundingBox())!;
  const pointer = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
    clientX: box.x + box.width * 0.3, clientY: box.y + box.height * 0.5 };
  await map.dispatchEvent('pointerdown', pointer);
  await map.dispatchEvent('pointercancel', pointer);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/\/$/);
  await map.dispatchEvent('pointerdown', pointer);
  await map.dispatchEvent('pointerdown', { ...pointer, pointerId: 2, isPrimary: false });
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/\/$/);
  await map.dispatchEvent('pointerup', { ...pointer, pointerId: 2, isPrimary: false });
  await map.dispatchEvent('pointerup', pointer);
  await map.dispatchEvent('pointerdown', pointer);
  await expect(page.getByAltText('New tag location')).toBeVisible();
  await map.dispatchEvent('pointerup', pointer);
  await expect(page).toHaveURL(/\/contribute\?.*placed=1/);
});
