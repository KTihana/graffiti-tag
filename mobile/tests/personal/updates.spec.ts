import { test, expect } from '@playwright/test';
import { PERSONAL_APP_VERSION } from '../../src/services/appUpdates';
const api = 'https://api.github.com/repos/KTihana/graffiti-tag/releases/latest';
const release = (version: string) => ({ tag_name: `v${version}-personal`, body: 'Improved archive tools.', assets: [{ name: 'graffiti-tag-personal.apk', browser_download_url: `https://github.com/KTihana/graffiti-tag/releases/download/v${version}-personal/graffiti-tag-personal.apk` }] });
test('downloads inside the app, reports progress, retries errors, and opens the installer', async ({ page }) => {
  let offline = false;
  let version = '9.0.0';
  await page.addInitScript(() => {
    const state = window as Window & { GraffitiNative?: unknown; updateDownloads?: string[]; updateInstalls?: number };
    state.GraffitiNative = {
      isNative: true,
      getAppVersion: async () => '1.0.6',
      downloadUpdate: async (url: string, onProgress: (percent: number | null) => void) => {
        (state.updateDownloads ??= []).push(url);
        onProgress(35);
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (state.updateDownloads.length === 1) throw new Error('Download interrupted. Please retry.');
        onProgress(100);
      },
      installUpdate: async () => {
        state.updateInstalls = (state.updateInstalls || 0) + 1;
        if (state.updateInstalls === 1) throw new Error('Allow updates from Graffiti Tag, then tap Install update again.');
      },
    };
  });
  await page.route(api, (route) => offline ? route.abort() : route.fulfill({ json: release(version) }));
  await page.goto('/account');
  await expect(page.getByText('Version 9.0.0 is available.', { exact: true })).toBeVisible();
  await expect(page.getByText('Improved archive tools.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Download update 9.0.0', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Update download' })).toHaveAttribute('aria-valuenow', '35');
  await expect(page.getByText('Download interrupted. Please retry.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Download update 9.0.0', exact: true }).click();
  await expect(page.getByText('Update downloaded. Ready to install.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Install update', exact: true }).click();
  await expect(page.getByText('Allow updates from Graffiti Tag, then tap Install update again.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Install update', exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { updateInstalls?: number }).updateInstalls)).toBe(2);
  expect(await page.evaluate(() => (window as Window & { updateDownloads?: string[] }).updateDownloads?.length)).toBe(2);
  await expect(page).toHaveURL(/\/account$/);
  expect(page.context().pages()).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'View GitHub releases', exact: true })).toHaveCount(0);
  offline = true;
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText(/Could not check for updates/)).toBeVisible();
  offline = false; version = PERSONAL_APP_VERSION;
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText('You have the latest version.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install update', exact: true })).toHaveCount(0);
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
