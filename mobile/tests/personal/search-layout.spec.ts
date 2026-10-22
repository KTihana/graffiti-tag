import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 412, height: 915 }, { width: 720, height: 1000 }, { width: 915, height: 412 }]) {
  test(`search keeps controls anchored at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route('https://photon.komoot.io/api/**', async (route) => {
      await pending;
      await route.fulfill({ json: { features: [
        { properties: { name: 'Osijek', osm_id: 1, osm_value: 'city', country: 'Hrvatska' }, geometry: { coordinates: [18.695, 45.555] } },
        { properties: { name: 'Osijek station', osm_id: 2, osm_value: 'station', city: 'Osijek' }, geometry: { coordinates: [18.683, 45.552] } },
      ] } });
    });
    await page.goto('/');
    const input = page.getByLabel('Search archive or city');
    await expect(input).toBeVisible();
    const controls = ['Your account', 'Filters', 'Find my location', 'Zoom in', 'Zoom out', 'Add tag', 'Explore'];
    const original = await Promise.all(controls.map((name) => page.getByRole('button', { name, exact: true }).boundingBox()));
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible();
    const mapBounds = await map.boundingBox();
    const stable = async () => {
      for (let i = 0; i < controls.length; i++) {
        const bounds = await page.getByRole('button', { name: controls[i], exact: true }).boundingBox();
        expect(bounds, controls[i]).not.toBeNull();
        expect(Math.abs(bounds!.x - original[i]!.x), `${controls[i]} horizontal position`).toBeLessThan(1);
        expect(Math.abs(bounds!.y - original[i]!.y), `${controls[i]} vertical position`).toBeLessThan(1);
      }
      const bounds = await map.boundingBox();
      expect(Math.abs(bounds!.height - mapBounds!.height), 'map height').toBeLessThan(1);
      expect(Math.abs(bounds!.width - mapBounds!.width), 'map width').toBeLessThan(1);
    };
    try {
      await input.click();
      await page.setViewportSize({ width: viewport.width, height: Math.max(300, viewport.height - 375) });
      await expect(input).toBeFocused();
      await expect(async () => stable()).toPass({ timeout: 2000 });
      await page.keyboard.type('Osijek');
      await expect(page.getByText('Find “Osijek” on the map', { exact: true })).toBeVisible();
      await stable();
      await input.press('Enter');
      await expect(page.getByText('Finding “Osijek”…', { exact: true })).toBeVisible();
      await stable();
      release();
      await expect(page.getByText('Choose a place', { exact: true })).toBeVisible();
      await stable();
      await page.setViewportSize(viewport);
      await expect(async () => stable()).toPass({ timeout: 2000 });
      await page.getByRole('button', { name: 'Clear location result', exact: true }).click();
      await stable();
      await page.screenshot({ path: `artifacts/stable-search-${viewport.width}.png` });
    } finally { release(); }
  });
}
