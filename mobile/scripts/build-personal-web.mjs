import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { copyFile, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'dist-personal');

function exportWeb() {
  rmSyncOutput();
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    executable,
    ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-personal', '--max-workers', '2'],
    {
      cwd: projectRoot,
      env: { ...process.env, EXPO_PUBLIC_ARCHIVE_MODE: 'personal' },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function rmSyncOutput() {
  // Expo export can leave unrelated old files behind, which would make the
  // generated precache depend on stale output from an earlier build.
  rmSync(outputDir, { recursive: true, force: true });
}

async function installIcons() {
  const source = path.join(projectRoot, 'assets', 'icon.png');
  const entries = [];
  for (const size of [192, 512]) {
    const fileName = `graffiti-icon-${size}.png`;
    const destination = path.join(outputDir, fileName);
    try {
      execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', destination], {
        stdio: 'ignore',
      });
      entries.push({ src: `/${fileName}`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable' });
    } catch {
      // Keep this build usable on systems without macOS sips. A larger square PNG
      // is a valid manifest icon and browsers can scale it for the launcher.
      const fallback = path.join(outputDir, 'graffiti-icon-1024.png');
      await copyFile(source, fallback);
      entries.push({ src: '/graffiti-icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' });
      break;
    }
  }
  return entries;
}

async function listFiles(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) result.push(...(await listFiles(path.join(directory, item.name), relative)));
    else if (item.isFile()) result.push(relative);
  }
  return result;
}

const cachedExtension = /\.(?:html?|js|mjs|css|ttf|otf|woff2?|eot|png|jpe?g|webp|avif|gif|svg|ico|json|webmanifest)$/i;
// Keep URL-safe @ and brackets as emitted by Expo; the browser canonicalizes spaces.
const encodePath = (file) => file;

function makeServiceWorker(version, files) {
  const urls = files.map((file) => `/${encodePath(file)}`);
  return `/* Personal offline app cache. Map tiles and remote APIs are never cached. */
const CACHE_PREFIX = 'graffiti-tag-personal-';
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const PRECACHE_URLS = ${JSON.stringify(urls)};
const AUTH_PATHS = new Set(['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback']);

self.addEventListener('install', (event) => {
  // Do not skipWaiting: an update waits until the current app session closes.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    // Do not claim existing tabs. They finish their current session on its own version.
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  const isAuthPath = [...AUTH_PATHS].some((path) => requestUrl.pathname === path || requestUrl.pathname === path + '/');
  if (requestUrl.origin !== scopeUrl.origin || isAuthPath) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch {}
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(new URL('/index.html', scopeUrl).href)) || Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(request);
    if (cached) return cached;
    // Runtime misses go to the network and are not added to a cache. In particular,
    // map tiles and third-party responses never enter this worker's caches.
    return fetch(request);
  })());
});
`;
}

async function main() {
  exportWeb();

  const indexPath = path.join(outputDir, 'index.html');
  let html = await readFile(indexPath, 'utf8');
  const icons = await installIcons();
  const manifest = {
    id: '/',
    name: 'Graffiti Tag Personal Archive',
    short_name: 'Graffiti Tag',
    description: 'A personal graffiti archive that works offline after its first load.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#DFFF65',
    background_color: '#F7F8F1',
    icons,
  };
  await writeFile(path.join(outputDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

  const headAddition = [
    '<link rel="manifest" href="/manifest.webmanifest">',
    `<link rel="apple-touch-icon" href="${icons[0].src}">`,
    '<meta name="theme-color" content="#DFFF65">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="apple-mobile-web-app-title" content="Graffiti Tag">',
    '<meta name="description" content="A personal graffiti archive that works offline after its first load. Map tiles require an internet connection.">',
  ].join('\n    ');
  if (html.includes('</head>')) html = html.replace('</head>', `    ${headAddition}\n  </head>`);
  else throw new Error(`Could not find </head> in ${indexPath}`);

  const registration = `<script>if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => console.warn('Offline support could not start:', error)); }); }</script>`;
  if (html.includes('</body>')) html = html.replace('</body>', `  ${registration}\n</body>`);
  else throw new Error(`Could not find </body> in ${indexPath}`);
  await writeFile(indexPath, html);

  const allFiles = await listFiles(outputDir);
  const precacheFiles = allFiles.filter((file) => file !== 'sw.js' && cachedExtension.test(file)).sort();
  if (!precacheFiles.includes('index.html')) throw new Error('Exported index.html was not included in the offline cache.');

  const hash = createHash('sha256');
  for (const file of precacheFiles) {
    hash.update(file);
    hash.update(await readFile(path.join(outputDir, file)));
  }
  const version = hash.digest('hex').slice(0, 16);
  await writeFile(path.join(outputDir, 'sw.js'), makeServiceWorker(version, precacheFiles));

  const bytes = (await Promise.all(precacheFiles.map(async (file) => (await stat(path.join(outputDir, file))).size)))
    .reduce((total, size) => total + size, 0);
  console.log(`Personal web app ready in dist-personal (${precacheFiles.length} offline files, ${(bytes / 1024 / 1024).toFixed(1)} MiB, cache ${version}).`);
  console.log('The app shell and local bundled media work offline after the first online load. Map tiles need internet access.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
