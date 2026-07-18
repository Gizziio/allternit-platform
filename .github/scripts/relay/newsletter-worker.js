// allternit-newsletter — Cloudflare Worker that runs the Allternit newsletter
// on our own stack: subscribers live in a Cloudflare D1 database (double
// opt-in) and mail goes out through the self-hosted iRedMail submission
// endpoint at news.allternit.com (OpenShip). No third-party newsletter
// provider is involved.
//
// GET  /health                              → "ok"
// POST /subscribe  { email, tag?, source? } → { ok: true, confirmSent } | { ok: true, already: true }
// GET  /confirm?token&email                 → branded HTML confirmation page
// GET  /unsubscribe?token&email             → branded HTML goodbye page
// GET  /subscribers?tag=&status=confirmed   (header: x-relay-token)
//                                           → { subscribers: [{ email, tag }] }
// POST /send       { subject, html, tag? }  (header: x-relay-token)
//                                           → { ok: true, sent: n }
//
// Secrets: NEWSLETTER_SEND_TOKEN — shared secret required on /send and /subscribers.
//          MAIL_SUBMIT_TOKEN     — shared secret for the mail-submit endpoint;
//                                  when unset, /subscribe still stores the row
//                                  but skips sending the confirmation email.
//
// Binding: DB — D1 database `allternit-newsletter` (see migrations/).

const MAIL_SUBMIT_URL = 'https://news.allternit.com/mail-submit';
const DEFAULT_TAG = 'allternit-news';
const SEND_BATCH_SIZE = 50;

// Same pattern the previous Buttondown relay used (max length 254).
const EMAIL_RE = /^[a-zA-Z0-9.'_%+\-!]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function json(body, status = 200) {
  return Response.json(body, { status });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function gated(request, env) {
  return (
    !env.NEWSLETTER_SEND_TOKEN ||
    request.headers.get('x-relay-token') !== env.NEWSLETTER_SEND_TOKEN
  );
}

// POST { to, subject, html } to the self-hosted mail-submit endpoint.
// Returns { ok, status?, error? }.
async function mailSubmit(env, payload) {
  if (!env.MAIL_SUBMIT_TOKEN) {
    return { ok: false, error: 'MAIL_SUBMIT_TOKEN not set' };
  }
  try {
    const res = await fetch(MAIL_SUBMIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MAIL_SUBMIT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, status: res.status, error: `mail-submit HTTP ${res.status}: ${detail}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: `mail-submit fetch failed: ${err.message}` };
  }
}

function confirmUrl(request, email, token) {
  const origin = new URL(request.url).origin;
  return `${origin}/confirm?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

function unsubscribeUrl(request, email, token) {
  const origin = new URL(request.url).origin;
  return `${origin}/unsubscribe?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

function confirmationEmailHtml(request, email, token) {
  const confirm = confirmUrl(request, email, token);
  const unsubscribe = unsubscribeUrl(request, email, token);
  return `<!doctype html>
<html><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 16px;">Allternit News</h1>
    <p>Please confirm your subscription to Allternit News by clicking the button below.</p>
    <p style="margin:24px 0;">
      <a href="${confirm}" style="display:inline-block;padding:12px 20px;background:#0b3d91;color:#ffffff;text-decoration:none;border-radius:6px;">Confirm subscription</a>
    </p>
    <p style="font-size:13px;color:#555;">If the button doesn't work, open this link:<br><a href="${confirm}">${confirm}</a></p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px;">
    <p style="font-size:12px;color:#888;">You received this email because ${email} was subscribed to Allternit News. If this wasn't you, you can <a href="${unsubscribe}">unsubscribe here</a>.</p>
  </div>
</body></html>`;
}

function page(title, message) {
  return new Response(
    `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Allternit News</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#f7f7f8;">
  <div style="max-width:560px;margin:48px auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Allternit News</h1>
    <p style="margin:0;">${message}</p>
  </div>
</body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

// Send the double-opt-in confirmation email. Never throws; returns whether
// the message was handed to mail-submit.
async function sendConfirmation(request, env, email, token) {
  if (!env.MAIL_SUBMIT_TOKEN) {
    console.log('MAIL_SUBMIT_TOKEN not set; skipping confirmation email for new subscriber');
    return false;
  }
  const result = await mailSubmit(env, {
    to: email,
    subject: 'Confirm your Allternit subscription',
    html: confirmationEmailHtml(request, email, token),
  });
  if (!result.ok) {
    console.error(`confirmation email failed for subscriber: ${result.error}`);
  }
  return result.ok;
}

async function handleSubscribe(request, env) {
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'missing or invalid email' }, 400);
  }

  const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim() : DEFAULT_TAG;
  const source = typeof body?.source === 'string' && body.source.trim() ? body.source.trim() : null;

  const existing = await env.DB.prepare(
    'SELECT status, confirm_token FROM subscribers WHERE email = ?',
  )
    .bind(email)
    .first();

  let token;
  if (existing) {
    if (existing.status === 'confirmed') {
      return json({ ok: true, already: true });
    }
    if (existing.status === 'pending') {
      // Resend the confirmation with the existing token.
      token = existing.confirm_token;
    } else {
      // Previously unsubscribed: re-subscribe as pending with a fresh token.
      token = randomToken();
      await env.DB.prepare(
        "UPDATE subscribers SET status = 'pending', confirm_token = ?, confirmed_at = NULL, tag = ?, source = ? WHERE email = ?",
      )
        .bind(token, tag, source, email)
        .run();
    }
  } else {
    token = randomToken();
    await env.DB.prepare(
      "INSERT INTO subscribers (email, tag, status, confirm_token, source) VALUES (?, ?, 'pending', ?, ?)",
    )
      .bind(email, tag, token, source)
      .run();
  }

  const confirmSent = await sendConfirmation(request, env, email, token);
  return json({ ok: true, confirmSent });
}

async function handleConfirm(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  if (!token || !email) {
    return page('Invalid link', 'This confirmation link is missing parameters.');
  }

  const result = await env.DB.prepare(
    "UPDATE subscribers SET status = 'confirmed', confirmed_at = datetime('now') WHERE email = ? AND confirm_token = ? AND status = 'pending'",
  )
    .bind(email, token)
    .run();

  if (result.meta.changes === 0) {
    const row = await env.DB.prepare(
      'SELECT status FROM subscribers WHERE email = ? AND confirm_token = ?',
    )
      .bind(email, token)
      .first();
    if (row?.status === 'confirmed') {
      return page('Already confirmed', "You're confirmed — welcome to Allternit News.");
    }
    return page('Invalid link', 'This confirmation link is invalid or has expired.');
  }

  return page('Confirmed', "You're confirmed — welcome to Allternit News.");
}

async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  if (!token || !email) {
    return page('Invalid link', 'This unsubscribe link is missing parameters.');
  }

  const result = await env.DB.prepare(
    "UPDATE subscribers SET status = 'unsubscribed' WHERE email = ? AND confirm_token = ? AND status != 'unsubscribed'",
  )
    .bind(email, token)
    .run();

  if (result.meta.changes === 0) {
    const row = await env.DB.prepare(
      'SELECT status FROM subscribers WHERE email = ? AND confirm_token = ?',
    )
      .bind(email, token)
      .first();
    if (row?.status === 'unsubscribed') {
      return page('Unsubscribed', "You've been unsubscribed from Allternit News. Sorry to see you go.");
    }
    return page('Invalid link', 'This unsubscribe link is invalid.');
  }

  return page('Unsubscribed', "You've been unsubscribed from Allternit News. Sorry to see you go.");
}

async function handleSubscribers(request, env) {
  if (gated(request, env)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const url = new URL(request.url);
  const tag = url.searchParams.get('tag')?.trim() || DEFAULT_TAG;
  const status = url.searchParams.get('status')?.trim() || 'confirmed';
  if (!['pending', 'confirmed', 'unsubscribed'].includes(status)) {
    return json({ ok: false, error: 'invalid status' }, 400);
  }

  const { results } = await env.DB.prepare(
    'SELECT email, tag FROM subscribers WHERE status = ? AND tag = ? ORDER BY created_at',
  )
    .bind(status, tag)
    .all();

  return json({ subscribers: results });
}

async function handleSend(request, env) {
  if (gated(request, env)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const body = await readJson(request);
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body?.html === 'string' ? body.html : '';
  if (!subject || !html) {
    return json({ ok: false, error: 'missing subject or html' }, 400);
  }
  if (!env.MAIL_SUBMIT_TOKEN) {
    return json({ ok: false, error: 'mail not configured' }, 503);
  }

  const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim() : DEFAULT_TAG;

  const { results } = await env.DB.prepare(
    "SELECT email FROM subscribers WHERE status = 'confirmed' AND tag = ?",
  )
    .bind(tag)
    .all();
  const emails = results.map((row) => row.email);

  let sent = 0;
  for (let i = 0; i < emails.length; i += SEND_BATCH_SIZE) {
    const batch = emails.slice(i, i + SEND_BATCH_SIZE);
    const result = await mailSubmit(env, { to: batch, subject, html });
    if (!result.ok) {
      return json({ ok: false, error: result.error, sent }, 502);
    }
    sent += batch.length;
  }

  return json({ ok: true, sent });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') return new Response('ok');

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      return handleSubscribe(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/confirm') {
      return handleConfirm(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/unsubscribe') {
      return handleUnsubscribe(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/subscribers') {
      return handleSubscribers(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/send') {
      return handleSend(request, env);
    }

    return new Response('not found', { status: 404 });
  },
};
