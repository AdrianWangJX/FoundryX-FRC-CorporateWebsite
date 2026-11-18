import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mkdir, chmod } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitInquiry } from './inquiries.mjs';
import { localDatabase } from './local-db.mjs';

const json = (value, status) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

// Nginx serves the site and proxies only this endpoint to the loopback service.
// The configured public origin is authoritative; forwarded headers cannot change it.
export function createInquiryServer({
  DB,
  publicOrigin,
  additionalOrigins = [],
  notificationEmail,
}) {
  const sites = new Map();
  for (const origin of [publicOrigin, ...additionalOrigins]) {
    const site = new URL(origin);
    if (
      !['http:', 'https:'].includes(site.protocol) ||
      site.username ||
      site.password ||
      site.pathname !== '/' ||
      site.search ||
      site.hash
    )
      throw new Error('Configured public origins must be HTTP(S) origins.');
    if (sites.has(site.host))
      throw new Error(
        'Configure only one protocol per public host; redirect other protocols at Nginx.',
      );
    sites.set(site.host, site);
  }
  const background = new Set();
  const context = {
    waitUntil(promise) {
      const job = Promise.resolve(promise).catch(() => {});
      background.add(job);
      job.finally(() => background.delete(job));
    },
  };
  const server = createServer(async (req, res) => {
    try {
      const site = sites.get(req.headers.host?.toLowerCase());
      const url = new URL(req.url, site?.origin || publicOrigin);
      let result;
      if (!site) result = json({ error: '请在网站内提交表单。' }, 403);
      else if (url.pathname !== '/api/inquiries')
        result = json({ error: 'Not found' }, 404);
      else {
        const signal = new AbortController();
        req.once('aborted', () => signal.abort());
        const request = new Request(
          new URL(url.pathname + url.search, site.origin),
          {
            method: req.method,
            headers: req.headers,
            signal: signal.signal,
            ...(['GET', 'HEAD'].includes(req.method)
              ? {}
              : { body: Readable.toWeb(req), duplex: 'half' }),
          },
        );
        result = await submitInquiry(
          request,
          { DB, FOUNDRYX_NOTIFICATION_EMAIL: notificationEmail },
          context,
        );
      }
      res.writeHead(result.status, Object.fromEntries(result.headers));
      if (req.method === 'HEAD' || !result.body) res.end();
      else await pipeline(Readable.fromWeb(result.body), res);
    } catch {
      if (!res.headersSent) {
        const result = json({ error: '提交服务暂不可用，请稍后重试。' }, 503);
        res.writeHead(503, Object.fromEntries(result.headers));
        res.end(await result.text());
      } else res.destroy();
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return {
    server,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await Promise.allSettled([...background]);
    },
  };
}

export async function startProductionServer(env = process.env) {
  const port = Number(env.FOUNDRYX_API_PORT || 8885);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('FOUNDRYX_API_PORT must be between 1 and 65535.');
  if (!env.FOUNDRYX_PUBLIC_ORIGIN)
    throw new Error('FOUNDRYX_PUBLIC_ORIGIN is required.');
  if (!env.FOUNDRYX_DB_PATH || !path.isAbsolute(env.FOUNDRYX_DB_PATH))
    throw new Error(
      'FOUNDRYX_DB_PATH must be an absolute persistent database path outside the public website.',
    );
  process.umask(0o077);
  await mkdir(path.dirname(env.FOUNDRYX_DB_PATH), {
    recursive: true,
    mode: 0o700,
  });
  const DB = localDatabase(env.FOUNDRYX_DB_PATH);
  await chmod(env.FOUNDRYX_DB_PATH, 0o600);
  DB.raw.exec(
    'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
  );
  let api;
  try {
    api = createInquiryServer({
      DB,
      publicOrigin: env.FOUNDRYX_PUBLIC_ORIGIN,
      additionalOrigins: (env.FOUNDRYX_ADDITIONAL_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      notificationEmail: env.FOUNDRYX_NOTIFICATION_EMAIL,
    });
    await new Promise((resolve, reject) => {
      api.server.once('error', reject);
      api.server.listen(port, '127.0.0.1', () => {
        api.server.removeListener('error', reject);
        resolve();
      });
    });
  } catch (error) {
    DB.raw.close();
    throw error;
  }
  let closing;
  const close = () =>
    (closing ??= (async () => {
      await api.close();
      DB.raw.close();
    })());
  return { ...api, DB, close, port };
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const api = await startProductionServer();
  console.log(`FoundryX inquiries: http://127.0.0.1:${api.port}/api/inquiries`);
  for (const event of ['SIGINT', 'SIGTERM'])
    process.once(event, () => {
      api.close().catch((error) => {
        console.error('Unable to close inquiry storage:', error.message);
        process.exitCode = 1;
      });
    });
}
