import { test, expect } from '@playwright/test';

test('map controls and filters remain reachable after resizing and rotating', async ({ page }) => {
  await page.goto('/');
  for (const size of [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    const zoom = page.getByRole('button', { name: 'Zoom out', exact: true });
    const saved = page.getByRole('button', { name: 'Explore', exact: true });
    await expect(zoom).toBeInViewport();
    await expect(saved).toBeInViewport();
    const zoomBox = (await zoom.boundingBox())!;
    const savedBox = (await saved.boundingBox())!;
    expect(zoomBox.y + zoomBox.height).toBeLessThan(savedBox.y);
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    await filters.scrollIntoViewIfNeeded();
    await filters.click();
    await page.getByLabel('Year photographed').fill('2018');
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect(page.getByLabel('Year photographed')).toBeHidden();
    const preview = page.getByTestId('wall-discovery');
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toBeInViewport();
    const previewBox = (await preview.boundingBox())!;
    expect(previewBox.y + previewBox.height).toBeLessThan(savedBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/responsive-${size.width}x${size.height}.png` });
  }
});
