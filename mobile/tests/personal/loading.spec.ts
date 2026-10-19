import { expect, test } from '@playwright/test';

test('startup artwork appears before JavaScript and gives way to the app', async ({ page }) => {
  let startApp!: () => void;
  const bundleGate = new Promise<void>((resolve) => { startApp = resolve; });
  await page.route(/\/_expo\/static\/js\/web\/.*\.js/, async (route) => {
    await bundleGate;
    await route.continue();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    const cover = page.getByRole('status', { name: 'Loading Graffiti Tag' });
    await expect(cover).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.launch-pin')).toHaveJSProperty('complete', true);
    expect(await page.locator('.launch-pin').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await page.locator('.launch-bar').evaluate((bar) => getComputedStyle(bar).animationName)).toBe('none');

    for (const viewport of [{ width: 320, height: 568 }, { width: 412, height: 915 }, { width: 915, height: 412 }, { width: 800, height: 1280 }]) {
      await page.setViewportSize(viewport);
      const pin = await page.locator('.launch-pin').boundingBox();
      const title = await page.locator('.launch-title').boundingBox();
      expect(pin).not.toBeNull();
      expect(title).not.toBeNull();
      for (const bounds of [pin!, title!]) {
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      }
    }
    await page.setViewportSize({ width: 412, height: 915 });
    await page.screenshot({ path: 'test-results/loading-screen-portrait.png' });
    startApp();
    await expect(cover).toHaveCount(0);
    await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Search archive or city' })).toBeVisible();
  } finally {
    startApp();
  }
});
