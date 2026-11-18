import assert from 'node:assert/strict';
import { submitInquiry } from '../src/server/inquiries.mjs';
import { localDatabase } from '../src/server/local-db.mjs';
const DB = localDatabase();
const base = () => ({
  requestId: crypto.randomUUID(),
  kind: 'student',
  name: '验证用申请',
  contact: 'test@example.com',
  grade: '10 年级',
  experience: '零基础',
  consent: true,
  website: '',
});
const send = (payload, overrides = {}, env = { DB }) =>
  submitInquiry(
    new Request('https://example.com/api/inquiries', {
      method: 'POST',
      headers: {
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      ...overrides,
    }),
    env,
  );
for (const extra of [
  {},
  { kind: 'partnership', organization: '验证学校', stage: '计划新建校队' },
  { kind: 'team', direction: '机械设计' },
  { kind: 'sponsorship', support: '设备与材料' },
]) {
  const payload = { ...base(), ...extra };
  const response = await send(payload);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).id, payload.requestId);
  assert.equal(
    (await send(payload)).status,
    200,
    'identical retries are accepted once',
  );
  assert.equal(
    (await send({ ...payload, name: '修改过的申请' })).status,
    409,
    'an id cannot silently replace a submission',
  );
}
assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n, 4);
for (const change of [
  { name: '' },
  { contact: '' },
  { consent: false },
  { kind: 'invalid' },
  { grade: 'invalid' },
  { requestId: 'unsafe' },
  { message: 'x'.repeat(2001) },
  { website: 'https://spam.test' },
  { kind: 'partnership', organization: '', stage: '计划新建校队' },
  { kind: 'team', direction: '' },
  { kind: 'sponsorship', support: '' },
])
  assert.equal((await send({ ...base(), ...change })).status, 400);
assert.equal(
  (
    await send(base(), {
      headers: {
        origin: 'https://other.test',
        'content-type': 'application/json',
      },
    })
  ).status,
  403,
);
assert.equal(
  (await send(base(), { headers: { 'content-type': 'text/plain' } })).status,
  415,
);
assert.equal((await send(base(), { body: 'not json' })).status, 400);
assert.equal((await send(base(), { body: 'x'.repeat(12001) })).status, 400);
assert.equal(
  (
    await submitInquiry(new Request('https://example.com/api/inquiries'), {
      DB,
    })
  ).status,
  405,
  'no public read endpoint',
);
assert.equal(
  (await send(base(), {}, {})).status,
  503,
  'missing binding must never show success',
);
assert.equal(
  (
    await send(
      base(),
      {},
      {
        DB: {
          prepare() {
            throw new Error('db failed');
          },
        },
      },
    )
  ).status,
  503,
  'database failure must never show success',
);
const sqlPayload = {
  ...base(),
  name: "O'Reilly; DROP TABLE inquiries; --",
  message: '<script>alert(1)</script>',
};
assert.equal((await send(sqlPayload)).status, 201);
assert.equal(
  DB.raw
    .prepare('SELECT contact_name FROM inquiries WHERE id = ?')
    .get(sqlPayload.requestId).contact_name,
  sqlPayload.name,
);
assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n, 5);
const concurrent = base();
const attempts = await Promise.all([send(concurrent), send(concurrent)]);
assert.deepEqual(attempts.map((result) => result.status).sort(), [200, 201]);
assert.equal(
  DB.raw
    .prepare('SELECT count(*) AS n FROM inquiries WHERE id = ?')
    .get(concurrent.requestId).n,
  1,
);
assert.equal(
  (await send(base(), { headers: { 'content-type': 'application/jsonp' } }))
    .status,
  415,
);
assert.equal(
  (
    await send(base(), {
      headers: { 'content-type': 'Application/JSON; charset=UTF-8' },
    })
  ).status,
  201,
);
DB.raw.close();
console.log(
  'All four inquiry types, persistence, retry deduplication, validation and failure cases passed.',
);
