// Loaded directly from APK assets by Android, even if a legacy worker serves an old page.
window.refreshGraffitiAppFiles = async function (force, build) {
  if (window.graffitiAppFilesRefreshing) return;
  window.graffitiAppFilesRefreshing = true;
  try {
    const controlled = !!navigator.serviceWorker?.controller;
    const registrations = await navigator.serviceWorker?.getRegistrations().catch(() => []) || [];
    const removed = await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    // These caches contain the offline app shell. Photos are in IndexedDB and
    // archive records are in localStorage; neither is touched by this recovery.
    const names = typeof caches === 'undefined' ? [] : await caches.keys().catch(() => []);
    await Promise.all(names.filter((name) => name.startsWith('graffiti-tag-personal-')).map((name) => caches.delete(name).catch(() => false)));
    if (force || removed.some(Boolean) || (controlled && !registrations.length)) {
      const url = new URL(location.href);
      url.searchParams.set('_appBuild', build);
      location.replace(url.toString());
    }
  } finally { window.graffitiAppFilesRefreshing = false; }
};
