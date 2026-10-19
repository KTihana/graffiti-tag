import { test, expect } from '@playwright/test';
import path from 'node:path';

declare global {
  interface Window {
    locationRequests: number;
    nativeLocationTest: {
      update: (accuracy: number) => void;
      fail: () => void;
      readonly stopped: number;
      readonly watches: number;
    };
  }
}

test('location is opt-in, updates the blue dot, and can recenter after moving', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 43.508, longitude: 16.44, accuracy: 12 });
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    let requests = 0;
    Object.defineProperty(window, 'locationRequests', { get: () => requests });
    navigator.geolocation.getCurrentPosition = (...args) => { requests++; original(...args); };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Find my location', exact: true })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
  const dot = page.getByRole('img', { name: 'Your current location', exact: true });
  await expect(dot).toHaveCount(0);
  await page.getByRole('button', { name: 'Find my location', exact: true }).click();
  await expect(dot).toBeVisible();
  await expect(page.getByText('You are here · Accuracy ~12 m', { exact: true })).toBeVisible();
  await expect(page.locator('.user-location-accuracy')).toHaveCount(1);
  // Wait for the map to finish its fly-to before checking subsequent GPS movement.
  await expect.poll(async () => Math.round((await dot.boundingBox())?.x || 0)).toBe(192);
  const initial = await dot.getAttribute('style');
  await context.setGeolocation({ latitude: 43.5085, longitude: 16.4405, accuracy: 8 });
  await expect(page.getByText('You are here · Accuracy ~8 m', { exact: true })).toBeVisible();
  await expect(dot).not.toHaveAttribute('style', initial!);
  await expect(dot).toHaveCount(1);
  await page.getByRole('button', { name: 'Find my location', exact: true }).click();
  await expect.poll(async () => Math.round((await dot.boundingBox())?.x || 0)).toBe(192);
  await page.screenshot({ path: 'artifacts/current-location-phone.png' });
});

test('denied location leaves browsing and manual wall placement usable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => {
      error?.({ code: 1, message: 'Permission denied' } as GeolocationPositionError);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Find my location', exact: true }).click();
  await expect(page.getByText('Location permission is off. You can still explore and place tags manually.', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your current location', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find my location', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Dismiss location message', exact: true }).click();
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles(path.join(process.cwd(), 'assets/demo/wall-3.jpg'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Location access is optional. You can place the pin manually.', { exact: true })).toBeVisible();
  await page.getByLabel('Wall name', { exact: true }).fill('Manually placed wall');
  await page.getByRole('checkbox', { name: 'Confirm wall location', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Photo year', { exact: true })).toBeVisible();
});

test('GPS on the contribution map updates the dot without moving a confirmed wall', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 43.508, longitude: 16.44, accuracy: 10 });
  await page.goto('/contribute');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await chooser).setFiles(path.join(process.cwd(), 'assets/demo/wall-3.jpg'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Use my location as a starting point', exact: true }).click();
  await expect(page.getByText('43.50800, 16.44000', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your current location', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Confirm wall location', exact: true }).click();
  await context.setGeolocation({ latitude: 43.5085, longitude: 16.4405, accuracy: 6 });
  await expect(page.getByText('You are here · Accuracy ~6 m', { exact: true })).toBeVisible();
  await expect(page.getByText('43.50800, 16.44000', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Confirm wall location', exact: true })).toBeChecked();
});

test('personal Android bridge updates location, clears failed fixes, and pauses in the background', async ({ page }) => {
  await page.addInitScript(() => {
    let stopped = 0, watches = 0;
    const state = window as Window & { GraffitiNative?: unknown };
    let update: (position: { latitude: number; longitude: number; accuracy: number }) => void;
    let fail: (error: unknown) => void;
    const position = { latitude: 43.508, longitude: 16.44, accuracy: 15 };
    state.GraffitiNative = {
      isNative: true,
      getLocation: async () => position,
      watchLocation: async (onPosition: typeof update, onError: typeof fail) => {
        watches++;
        update = onPosition;
        fail = onError;
        return () => { stopped++; };
      },
    };
    state.nativeLocationTest = {
      update: (accuracy) => update({ ...position, accuracy }),
      fail: () => fail({ code: 'OS-PLUG-GLOC-0003', message: 'Permission denied' }),
      get stopped() { return stopped; },
      get watches() { return watches; },
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Find my location', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Your current location', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.nativeLocationTest.watches)).toBe(1);
  await page.evaluate(() => window.nativeLocationTest.update(7));
  await expect(page.getByText('You are here · Accuracy ~7 m', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.nativeLocationTest.stopped)).toBe(1);
  await expect(page.getByRole('img', { name: 'Your current location', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.nativeLocationTest.watches)).toBe(2);
  await page.evaluate(() => window.nativeLocationTest.update(5));
  await expect(page.getByRole('img', { name: 'Your current location', exact: true })).toBeVisible();
  await page.evaluate(() => window.nativeLocationTest.fail());
  await expect(page.getByText('Location permission is off. You can still explore and place tags manually.', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your current location', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.nativeLocationTest.stopped)).toBe(2);
});
