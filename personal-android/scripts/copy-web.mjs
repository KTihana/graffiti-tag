import { build } from 'esbuild';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, '..', 'mobile', 'dist-personal');
const destination = path.join(root, 'www');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
try {
  await cp(source, destination, { recursive: true, errorOnExist: false });
} catch (error) {
  throw new Error(
    `Could not copy ${source}. Run the personal web export first: cd ../mobile && node scripts/build-personal-web.mjs`,
    { cause: error },
  );
}

const indexPath = path.join(destination, 'index.html');
let html = await readFile(indexPath, 'utf8');

// Android's local Capacitor origin is the app shell. Keep it away from the PWA
// worker, which would interfere with Capacitor's injected native plugin bridge.
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (script) =>
  script.includes('navigator.serviceWorker.register') ? '' : script,
);

// Capacitor 8 uses Android's edge-to-edge layout. The app already uses
// react-native-safe-area-context; viewport-fit=cover lets its web implementation
// read the system inset environment variables inside the WebView.
html = html.replace(
  /(<meta\s+name=["']viewport["']\s+content=["'])([^"']*)(["'][^>]*>)/i,
  (_tag, before, content, after) =>
    `${before}${content.includes('viewport-fit=') ? content : `${content}, viewport-fit=cover`}${after}`,
);
html = html.replace('</head>', '  <script defer src="/native-bridge.js"></script>\n</head>');
await writeFile(indexPath, html);
await rm(path.join(destination, 'sw.js'), { force: true });

await build({
  entryPoints: [path.join(root, 'src', 'native-bridge.ts')],
  outfile: path.join(destination, 'native-bridge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
});

await copyFile(path.join(root, 'src/app-files-recovery.js'), path.join(destination, 'app-files-recovery.js'));

console.log(`Copied ${source} to www, removed PWA worker registration, and bundled GraffitiNative bridge.`);
