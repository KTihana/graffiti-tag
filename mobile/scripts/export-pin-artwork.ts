import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Approved spray-painted masters are shared by web, native, and launcher assets.
const assets = resolve(process.cwd(), 'assets');
const masterUri = (name: string) =>
  'data:image/png;base64,' + readFileSync(resolve(assets, 'brand', name)).toString('base64');

function pinSvg(uri: string, width = 320, height = 360): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
    '" viewBox="0 0 320 360"><image href="' + uri +
    '" width="320" height="360" preserveAspectRatio="xMidYMid meet"/></svg>';
}

async function main() {
  mkdirSync(resolve(assets, 'markers'), { recursive: true });
  const selected = masterUri('spray-pin-lime-master.png');
  const normal = masterUri('spray-pin-cream-master.png');
  const browser = await chromium.launch();
  try {
    async function render(svg: string, path: string, scale = 1) {
      const page = await browser.newPage({ deviceScaleFactor: scale });
      try {
        await page.setContent('<html><body style="margin:0;background:transparent">' + svg + '</body></html>');
        await page.waitForFunction(() => {
          const image = document.querySelector('svg image');
          if (!image) return false;
          const probe = new Image();
          probe.src = image.getAttribute('href') || '';
          return probe.complete && probe.naturalWidth > 0;
        });
        await page.locator('svg').screenshot({ path, omitBackground: true });
      } finally {
        await page.close();
      }
    }

    const brand = pinSvg(selected);
    writeFileSync(resolve(assets, 'brand-pin.svg'), brand);
    await render(brand, resolve(assets, 'brand-pin.png'));

    // Four physical pixels per point preserve paint detail on retina screens.
    await render(pinSvg(normal, 44, 50), resolve(assets, 'markers', 'pin.png'), 4);
    await render(pinSvg(selected, 44, 50), resolve(assets, 'markers', 'pin-selected.png'), 4);

    const launcher = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#DFFF65"/><image href="' +
      selected + '" x="152" y="72" width="720" height="880" preserveAspectRatio="xMidYMid meet"/></svg>';
    writeFileSync(resolve(assets, 'brand-icon.svg'), launcher);
    await render(launcher, resolve(assets, 'icon.png'));
    await render(launcher.replace('width="1024" height="1024"', 'width="64" height="64"'), resolve(assets, 'favicon.png'));

    // Keep the artwork inside the existing Android adaptive icon safe area.
    const adaptive = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image href="' +
      selected + '" x="267" y="202" width="490" height="551" preserveAspectRatio="xMidYMid meet"/></svg>';
    await render(adaptive, resolve(assets, 'android-icon-foreground.png'));
    console.log('Exported black-bordered spray pins, brand mark, and app icons.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
