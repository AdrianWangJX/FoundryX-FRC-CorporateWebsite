import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { localDatabase } from '../src/server/local-db.mjs';
import { createInquiryServer } from '../src/server/production.mjs';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'foundryx-api-'));
const dbPath = path.join(temporary, 'test.sqlite');
const origin = 'https://foundryx.xyz';
const submission = {
  requestId: crypto.randomUUID(),
  kind: 'student',
  grade: '10 年级',
  consent: true,
  name: 'Integration test',
  contact: 'test@example.com',
};
try {
  // Open the same database twice to verify persisted submissions across restarts.
  for (const expectedStatus of [201, 200]) {
    const DB = localDatabase(dbPath);
    const api = createInquiryServer({ DB, publicOrigin: origin });
    try {
      api.server.listen(0, '127.0.0.1');
      await once(api.server, 'listening');
      const url = new URL(
        '/api/inquiries',
        'http://127.0.0.1:' + api.server.address().port,
      );
      const headers = {
        host: 'foundryx.xyz',
        origin,
        'content-type': 'application/json',
      };
      // Set Host explicitly as the production reverse proxy does. Node fetch controls Host itself.
      async function send(method, body) {
        return new Promise((resolve, reject) => {
          const req = request(url, { method, headers }, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              text += chunk;
            });
            res.on('end', () =>
              resolve({ status: res.statusCode, data: JSON.parse(text) }),
            );
          });
          req.on('error', reject);
          req.end(body);
        });
      }
      assert.equal((await send('GET')).status, 405);
      const saved = await send('POST', JSON.stringify(submission));
      assert.equal(saved.status, expectedStatus);
      assert.equal(saved.data.id, submission.requestId);
      assert.equal(
        DB.raw.prepare('SELECT count(*) AS n FROM inquiries').get().n,
        1,
      );
    } finally {
      await api.close();
      DB.raw.close();
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
