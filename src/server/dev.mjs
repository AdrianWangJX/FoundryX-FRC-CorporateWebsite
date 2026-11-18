import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import worker from './worker.mjs';
import { localDatabase } from './local-db.mjs';
const port = Number(process.env.PORT || 8879),
  host = '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be between 1 and 65535.');
const base = `http://${host}:${port}`;
await mkdir('work', { recursive: true });
const DB = localDatabase('work/inquiries-local.sqlite'),
  root = path.resolve('dist/client');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.gz': 'application/octet-stream',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};
const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url),
      file = path.resolve(
        root,
        '.' +
          decodeURIComponent(url.pathname) +
          (url.pathname.endsWith('/')
            ? 'index.html'
            : path.extname(url.pathname)
              ? ''
              : '.html'),
      );
    if (!file.startsWith(root + path.sep))
      return new Response('Not found', { status: 404 });
    try {
      if (/\.(mp4|webm)$/.test(file)) {
        const { size } = await stat(file),
          headers = {
            'Content-Type': types[path.extname(file)],
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, max-age=3600',
          };
        const range = request.headers.get('range');
        let start = 0,
          end = size - 1,
          status = 200;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match || (!match[1] && !match[2]))
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${size}` },
            });
          start = match[1]
            ? Number(match[1])
            : Math.max(0, size - Number(match[2]));
          end =
            match[1] && match[2]
              ? Math.min(size - 1, Number(match[2]))
              : size - 1;
          if (start >= size || start > end)
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${size}` },
            });
          status = 206;
          headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        }
        headers['Content-Length'] = String(end - start + 1);
        return new Response(
          request.method === 'HEAD'
            ? null
            : Readable.toWeb(createReadStream(file, { start, end })),
          { status, headers },
        );
      }
      return new Response(await readFile(file), {
        headers: {
          'Content-Type':
            types[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  },
};
createServer(async (req, res) => {
  try {
    const request = new Request(
      new URL(req.url, req.headers.host ? `http://${req.headers.host}` : base),
      {
        method: req.method,
        headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method)
          ? {}
          : { body: Readable.toWeb(req), duplex: 'half' }),
      },
    );
    const result = await worker.fetch(
      request,
      { DB, ASSETS },
      {
        waitUntil(promise) {
          promise.catch(() => {});
        },
      },
    );
    res.writeHead(result.status, Object.fromEntries(result.headers));
    if (req.method === 'HEAD' || !result.body) res.end();
    else await pipeline(Readable.fromWeb(result.body), res);
  } catch {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Local server error');
    } else res.destroy();
  }
}).listen(port, host, () => console.log(`Local: ${base}/`));
