const SITE = 'https://foundryx.xyz';

// The recipient is a server-side setting, never a value supplied by visitors.
export async function notifyInquiry(env, id, send = fetch) {
  const recipient = env.FOUNDRYX_NOTIFICATION_EMAIL;
  if (!recipient) return;
  const row = await env.DB.prepare(
    "UPDATE inquiries SET notification_status = 'sending' WHERE id = ? AND notification_status = 'pending' RETURNING inquiry_type, contact_name, contact_method, details, submitted_at",
  )
    .bind(id)
    .first();
  if (!row) return;
  let status = 'email_failed',
    diagnostic = null;
  try {
    const response = await send(
      'https://formsubmit.co/ajax/' + encodeURIComponent(recipient),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: SITE + '/join.html',
          'User-Agent': 'FoundryX/1.0',
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          _subject: `FoundryX｜${row.inquiry_type} · ${row.contact_name.replace(/[\r\n]/g, ' ').slice(0, 60)}`,
          _template: 'table',
          _url: SITE + '/join.html',
          申请类型: row.inquiry_type,
          称呼: row.contact_name,
          联系方式: row.contact_method,
          详细内容: row.details || '未填写补充信息',
          提交时间: row.submitted_at,
          申请编号: id,
        }),
      },
    );
    const result = await response.json().catch(() => null);
    if (!result) {
      status = `email_http_${response.status}_${response.headers.get('cf-mitigated') === 'challenge' ? 'challenge' : 'non_json'}`;
      console.warn('FoundryX notification response', {
        id,
        http_status: response.status,
        reason: 'non_json_response',
      });
    }
    if (response.ok && (result?.success === true || result?.success === 'true'))
      status = 'email_accepted';
    else if (/activat/i.test(result?.message || ''))
      status = 'awaiting_activation';
    else if (result) {
      status = `email_http_${response.status}_rejected`;
      console.warn('FoundryX notification response', {
        id,
        http_status: response.status,
        reason: 'provider_rejected',
      });
    }
    if (status !== 'email_accepted' && status !== 'awaiting_activation') {
      let message = typeof result?.message === 'string' ? result.message : '';
      for (const value of [recipient, ...Object.values(row)])
        if (typeof value === 'string' && value.length >= 3)
          message = message.split(value).join('[redacted]');
      message = message
        .replace(/https?:\/\/\S+/g, '[url]')
        .replace(/[\w.+-]+@[\w.-]+/g, '[email]')
        .slice(0, 300);
      diagnostic = JSON.stringify({
        http_status: response.status,
        retry_after: response.headers.get('retry-after')?.slice(0, 80) || null,
        message,
      });
    }
  } catch (error) {
    // Record no contact details, recipient, payload, or provider response body.
    status =
      error?.name === 'TimeoutError' ? 'email_timeout' : 'email_fetch_failed';
    diagnostic = JSON.stringify({ error: status });
    console.warn('FoundryX notification error', {
      id,
      error_name: error?.name || 'Error',
    });
  }
  await env.DB.prepare(
    'UPDATE inquiries SET notification_status = ?, notification_error = ? WHERE id = ?',
  )
    .bind(status, diagnostic, id)
    .run();
}
