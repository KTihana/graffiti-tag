import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { sprayCanArtwork } from '../src/components/sprayCanArtwork';

async function main() {
  mkdirSync('assets/markers', { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 42, height: 42 }, deviceScaleFactor: 4 });
  for (const selected of [false, true]) {
    const background = selected ? '#DFFF65' : '#242B24';
    const foreground = selected ? '#242B24' : '#DFFF65';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="18.5" fill="${background}" stroke="#fff" stroke-width="3"/><g transform="translate(7 3.5) scale(.215)">${sprayCanArtwork(foreground, background)}</g></svg>`;
    const name = selected ? 'aerosol-selected' : 'aerosol';
    writeFileSync(`assets/markers/${name}.svg`, svg);
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
    await page.screenshot({ path: `assets/markers/${name}.png`, omitBackground: true });
  }
  await browser.close();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
