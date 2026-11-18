import { notifyInquiry } from './notifications.mjs';
const types = {
  student: '成为学员',
  partnership: '校队合作',
  team: '加入团队',
  sponsorship: '赞助意向',
};
const fields = {
  student: {
    grade: '当前年级',
    experience: '已有基础',
    message: '想了解的问题',
  },
  partnership: {
    organization: '学校 / 机构',
    stage: '当前项目',
    message: '希望获得的支持',
  },
  team: {
    direction: '意向方向',
    portfolio: '作品 / 简历链接',
    message: '自我介绍',
  },
  sponsorship: {
    organization: '公司 / 机构',
    support: '赞助意向',
    message: '合作想法',
  },
};
const choices = {
  grade: ['8 年级及以下', '9 年级', '10 年级', '11 年级', '12 年级', '其他'],
  stage: ['计划新建校队', '已有 FRC 校队', '已有其他机器人项目', '其他'],
  direction: ['机械设计', '电控与编程', '教学与带队', '运营与传播', '其他'],
  support: ['资金支持', '设备与材料', '场地与资源', '其他合作'],
};
const required = {
  student: ['grade'],
  partnership: ['organization', 'stage'],
  team: ['direction'],
  sponsorship: ['support'],
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
function clean(value, max = 160) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max)
    throw new Error('请检查输入内容的长度。');
  return value.trim();
}
async function body(request) {
  if (Number(request.headers.get('content-length')) > 12000)
    throw new Error('填写的内容过长，请精简后重试。');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('请填写表单后提交。');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) {
        await reader.cancel();
        throw new Error('填写的内容过长，请精简后重试。');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('提交格式无效，请刷新后重试。');
  }
}
export async function submitInquiry(request, env, ctx) {
  if (request.method !== 'POST')
    return json({ error: '仅支持提交表单。' }, 405);
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return json({ error: '请在网站内提交表单。' }, 403);
  if (
    (request.headers.get('content-type') || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase() !== 'application/json'
  )
    return json({ error: '请通过网站表单提交。' }, 415);
  let entry;
  try {
    const data = await body(request);
    if (!data || Array.isArray(data) || typeof data !== 'object')
      throw new Error('提交格式无效。');
    if (typeof data.kind !== 'string' || !Object.hasOwn(types, data.kind))
      throw new Error('请选择有效的申请类型。');
    if (data.website) throw new Error('暂时无法提交，请刷新后重试。');
    if (
      typeof data.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        data.requestId,
      )
    )
      throw new Error('提交标识无效，请刷新后重试。');
    const name = clean(data.name),
      contact = clean(data.contact);
    if (!name || contact.length < 3)
      throw new Error('请填写你的称呼和有效联系方式。');
    if (data.consent !== true) throw new Error('请先同意保存信息并联系你。');
    const detail = {};
    for (const [key, label] of Object.entries(fields[data.kind])) {
      const value = clean(data[key], key === 'message' ? 2000 : 160);
      if (required[data.kind].includes(key) && !value)
        throw new Error(`请填写${label}。`);
      if (value && choices[key] && !choices[key].includes(value))
        throw new Error(`请选择有效的${label}。`);
      if (value) detail[label] = value;
    }
    entry = {
      id: data.requestId,
      kind: data.kind,
      name,
      contact,
      details: Object.entries(detail)
        .map(([key, value]) => `${key}：${value}`)
        .join('\n'),
    };
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  if (!env.DB) return json({ error: '提交服务暂不可用，请稍后重试。' }, 503);
  try {
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(JSON.stringify(entry)),
        ),
      ),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    const inserted = await env.DB.prepare(
      `
    INSERT INTO inquiries
      (id, submitted_at, inquiry_type, contact_name, contact_method, details,
       payload_hash, consent_version, notification_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING RETURNING id
  `,
    )
      .bind(
        entry.id,
        new Date().toISOString(),
        types[entry.kind],
        entry.name,
        entry.contact,
        entry.details,
        hash,
        'join-2026-09-19',
        env.FOUNDRYX_NOTIFICATION_EMAIL ? 'pending' : 'not_configured',
      )
      .first();
    if (!inserted) {
      const previous = await env.DB.prepare(
        'SELECT payload_hash FROM inquiries WHERE id = ?',
      )
        .bind(entry.id)
        .first();
      return previous?.payload_hash === hash
        ? json({ id: entry.id })
        : json({ error: '提交内容已更改，请刷新后重新填写。' }, 409);
    }
    if (env.FOUNDRYX_NOTIFICATION_EMAIL) {
      const notification = notifyInquiry(env, entry.id).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(notification);
      else await notification;
    }
    return json({ id: entry.id }, 201);
  } catch {
    return json(
      { error: '暂时无法保存，请稍后重试。已填写的内容会保留。' },
      503,
    );
  }
}
