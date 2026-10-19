import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.PREVIEW_DIRECTORY || 'dist-web');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    } catch {
      if (!extname(pathname)) file = resolve(root, 'index.html');
      else throw new Error('Not found');
    }
    const bytes = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end('Not found. Run npm run export:web before starting the preview.');
  }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log(`Graffiti Tag preview: http://localhost:${process.env.PORT || 4173}`),
);
