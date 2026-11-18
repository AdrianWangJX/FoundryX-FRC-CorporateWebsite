import assert from 'node:assert/strict';
import { localDatabase } from '../src/server/local-db.mjs';
import { notifyInquiry } from '../src/server/notifications.mjs';
const DB = localDatabase();
const add = () => {
  const id = crypto.randomUUID();
  DB.raw
    .prepare(
      'INSERT INTO inquiries (id, submitted_at, inquiry_type, contact_name, contact_method, details, payload_hash, consent_version, notification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      new Date().toISOString(),
      '成为学员',
      '通知测试',
      'test@example.com',
      '当前年级：10 年级',
      'test',
      'join-2026-09-19',
      'pending',
    );
  return id;
};
const status = (id) =>
  DB.raw
    .prepare('SELECT notification_status FROM inquiries WHERE id = ?')
    .get(id).notification_status;
for (const [response, expected] of [
  [{ success: 'true' }, 'email_accepted'],
  [
    { success: 'false', message: 'This form needs Activation' },
    'awaiting_activation',
  ],
  [{ success: false }, 'email_http_200_rejected'],
]) {
  const id = add();
  let calls = 0;
  const send = async (url, options) => {
    calls++;
    assert.equal(url, 'https://formsubmit.co/ajax/owner%40example.com');
    const payload = JSON.parse(options.body);
    assert.equal(payload._url, 'https://foundryx.xyz/join.html');
    assert.equal(options.headers.Referer, payload._url);
    assert.equal(payload['申请编号'], id);
    assert.equal(payload['联系方式'], 'test@example.com');
    return Response.json(response);
  };
  await notifyInquiry(
    { DB, FOUNDRYX_NOTIFICATION_EMAIL: 'owner@example.com' },
    id,
    send,
  );
  assert.equal(status(id), expected);
  await notifyInquiry(
    { DB, FOUNDRYX_NOTIFICATION_EMAIL: 'owner@example.com' },
    id,
    send,
  );
  assert.equal(
    calls,
    1,
    'retries cannot duplicate an accepted or claimed email',
  );
}
const id = add();
await notifyInquiry(
  { DB, FOUNDRYX_NOTIFICATION_EMAIL: 'owner@example.com' },
  id,
  async () => {
    throw new Error('network failure');
  },
);
assert.equal(status(id), 'email_fetch_failed');
assert.ok(
  DB.raw.prepare('SELECT id FROM inquiries WHERE id = ?').get(id),
  'mail failure retains application',
);
const blocked = add();
await notifyInquiry(
  { DB, FOUNDRYX_NOTIFICATION_EMAIL: 'owner@example.com' },
  blocked,
  async () =>
    new Response('Challenge', {
      status: 403,
      headers: { 'content-type': 'text/html', 'cf-mitigated': 'challenge' },
    }),
);
assert.equal(status(blocked), 'email_http_403_challenge');
const limited = add();
await notifyInquiry(
  { DB, FOUNDRYX_NOTIFICATION_EMAIL: 'owner@example.com' },
  limited,
  async () =>
    Response.json(
      {
        success: false,
        message: 'Too many requests for owner@example.com test@example.com',
      },
      { status: 429, headers: { 'retry-after': '3600' } },
    ),
);
const diagnostic = JSON.parse(
  DB.raw
    .prepare('SELECT notification_error FROM inquiries WHERE id = ?')
    .get(limited).notification_error,
);
assert.equal(diagnostic.retry_after, '3600');
assert.equal(diagnostic.http_status, 429);
assert.ok(
  !diagnostic.message.includes('@'),
  'diagnostics redact contact and recipient addresses',
);
DB.raw.close();
console.log(
  'Notification acceptance, activation, failure, recipient isolation and duplicate protection passed.',
);
