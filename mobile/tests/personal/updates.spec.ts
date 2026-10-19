import { test, expect } from '@playwright/test';
const api = 'https://api.github.com/repos/KTihana/graffiti-tag/releases/latest';
const release = (version: string) => ({ tag_name: `v${version}-personal`, body: 'Improved archive tools.', assets: [{ name: 'graffiti-tag-personal.apk', browser_download_url: `https://github.com/KTihana/graffiti-tag/releases/download/v${version}-personal/graffiti-tag-personal.apk` }] });
test('checks updates, opens the APK, handles offline errors and retries', async ({ page }) => {
  let offline = false;
  let version = '1.0.5';
  await page.route(api, (route) => offline ? route.abort() : route.fulfill({ json: release(version) }));
  await page.route('**/v1.0.5-personal/graffiti-tag-personal.apk', (route) => route.fulfill({ body: 'APK download', contentType: 'application/vnd.android.package-archive', headers: { 'Content-Disposition': 'attachment; filename=graffiti-tag-personal.apk' } }));
  await page.goto('/account');
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText('Version 1.0.5 is available.', { exact: true })).toBeVisible();
  await expect(page.getByText('Improved archive tools.', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download update 1.0.5', exact: true }).click();
  const download = await downloadPromise;
  expect(download.url()).toContain('/v1.0.5-personal/graffiti-tag-personal.apk');
  offline = true;
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText(/Could not check for updates/)).toBeVisible();
  offline = false; version = '1.0.4';
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText('You have the latest version.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download update 1.0.5', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/app-updates.png', fullPage: true });
});
test('installed app checks on launch and shows a map banner', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { GraffitiNative?: unknown }).GraffitiNative = { isNative: true, getAppVersion: async () => '1.0.2' };
  });
  await page.route(api, (route) => route.fulfill({ json: release('1.0.4') }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Update 1.0.4 available', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Version 1.0.2 · Personal Android', { exact: true })).toBeVisible();
});
