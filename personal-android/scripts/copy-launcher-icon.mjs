import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidApp = path.join(root, 'android', 'app', 'src', 'main');
const source = path.resolve(root, '..', 'mobile', 'assets', 'icon.png');
const resources = path.join(androidApp, 'res');
const mipmaps = (await readdir(resources, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$/.test(entry.name))
  .map((entry) => path.join(resources, entry.name));

if (mipmaps.length === 0) throw new Error('Capacitor Android launcher mipmap directories were not found.');

for (const directory of mipmaps) {
  await mkdir(directory, { recursive: true });
  const match = directory.match(/mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)/);
  const density = match?.[1];
  const sizes = {
    mdpi: { launcher: 48, foreground: 108 },
    hdpi: { launcher: 72, foreground: 162 },
    xhdpi: { launcher: 96, foreground: 216 },
    xxhdpi: { launcher: 144, foreground: 324 },
    xxxhdpi: { launcher: 192, foreground: 432 },
  }[density];
  for (const [name, kind] of [
    ['ic_launcher.png', 'launcher'],
    ['ic_launcher_round.png', 'launcher'],
    ['ic_launcher_foreground.png', 'foreground'],
  ]) {
    const destination = path.join(directory, name);
    const size = sizes?.[kind];
    if (size && process.platform === 'darwin') {
      execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', destination], {
        stdio: 'ignore',
      });
    } else {
      await cp(source, destination);
    }
  }
}

const background = path.join(resources, 'values', 'ic_launcher_background.xml');
const colorXml = await readFile(background, 'utf8');
await writeFile(background, colorXml.replace(/<color name="ic_launcher_background">[^<]*<\/color>/, '<color name="ic_launcher_background">#DFFF65</color>'));

console.log(`Applied the existing mobile/assets/icon.png to ${mipmaps.length} Android launcher resource folders.`);
