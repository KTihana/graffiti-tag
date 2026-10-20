import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const recovery = await readFile(new URL('../src/app-files-recovery.js', import.meta.url), 'utf8');

test('recovers an old screen controlled by an offline worker and preserves archive and photo storage', async () => {
  const stale = '<!doctype html><h1>All tags · Pieces · Murals</h1>';
  const current = '<!doctype html><h1>Current app: compact filters</h1>';
  const worker = `
self.addEventListener('install', event => event.waitUntil((async()=>{
 const cache=await caches.open('graffiti-tag-personal-old-shell');
 await cache.put('/',new Response(${JSON.stringify(stale)},{headers:{'Content-Type':'text/html'}}));
 await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode==='navigate') event.respondWith(caches.open('graffiti-tag-personal-old-shell').then(c=>c.match('/')));
});`;
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', req.url === '/legacy-worker.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/legacy-worker.js' ? worker : current);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      localStorage.setItem('graffiti-tag-personal-v1', JSON.stringify({ tags: [{ title: 'My wall' }] }));
      localStorage.setItem('graffiti-tag-personal-social-v1', JSON.stringify({ liked: ['piece-1'] }));
      await (await caches.open('unrelated-cache')).put('/keep', new Response('keep'));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('graffiti-photo-proof', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('photos');
        request.onsuccess = () => {
          const transaction = request.result.transaction('photos', 'readwrite');
          transaction.objectStore('photos').put(new Blob(['original-photo'], { type: 'image/jpeg' }), 'photo-1');
          transaction.oncomplete = () => { request.result.close(); resolve(); };
          transaction.onerror = reject;
        };
        request.onerror = reject;
      });
      await navigator.serviceWorker.register('/legacy-worker.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    await page.reload();
    assert.match(await page.textContent('body'), /All tags/);
    await page.addScriptTag({ content: recovery });
    await Promise.all([
      page.waitForURL('**/?_appBuild=1.0.7%3A8'),
      page.evaluate(() => window.refreshGraffitiAppFiles(false, '1.0.7:8')),
    ]);
    await page.waitForLoadState('load');
    assert.match(await page.textContent('body'), /Current app: compact filters/);
    const data = await page.evaluate(async () => ({
      archive: JSON.parse(localStorage.getItem('graffiti-tag-personal-v1')),
      social: JSON.parse(localStorage.getItem('graffiti-tag-personal-social-v1')),
      caches: await caches.keys(),
      registrations: (await navigator.serviceWorker.getRegistrations()).length,
      photo: await new Promise((resolve, reject) => {
        const request = indexedDB.open('graffiti-photo-proof', 1);
        request.onsuccess = () => {
          const read = request.result.transaction('photos').objectStore('photos').get('photo-1');
          read.onsuccess = async () => { resolve(await read.result.text()); request.result.close(); };
          read.onerror = reject;
        };
        request.onerror = reject;
      }),
    }));
    assert.deepEqual(data.archive, { tags: [{ title: 'My wall' }] });
    assert.deepEqual(data.social, { liked: ['piece-1'] });
    assert.equal(data.photo, 'original-photo');
    assert.deepEqual(data.caches, ['unrelated-cache']);
    assert.equal(data.registrations, 0);
    // Manual recovery also refreshes an uncontrolled page and keeps its current route.
    await page.goto(`http://127.0.0.1:${server.address().port}/about?existing=1`);
    await page.addScriptTag({ content: recovery });
    await Promise.all([
      page.waitForURL('**/about?existing=1&_appBuild=1.0.7%3A8'),
      page.evaluate(() => window.refreshGraffitiAppFiles(true, '1.0.7:8')),
    ]);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('graffiti-tag-personal-v1')).tags[0].title), 'My wall');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
