// allternit-newsletter — Cloudflare Worker that fronts Buttondown for the
// Allternit platform. The site and the GitHub Actions pipeline call this
// relay so the Buttondown API key never leaves the worker's secret store.
//
// GET  /health                           → "ok"
// POST /subscribe  { email, tag? }       → { ok: true } | { ok: false, error }
// POST /send       { subject, html, tag? } (header: x-relay-token)
//                                        → Buttondown email JSON | { ok: false, error }
//
// Secrets: BUTTONDOWN_API_KEY   — Buttondown API key, sent as `Token <key>`.
//          NEWSLETTER_SEND_TOKEN — shared secret required on /send.
//
// API shapes validated against Buttondown's OpenAPI spec
// (https://docs.buttondown.com/openapi.json):
//   POST /v1/subscribers ← { email_address, tags[] }   → 201 created, 409 conflict
//   POST /v1/emails      ← { subject, body, status }   → 201 created
// EmailInput is a closed schema (additionalProperties: false) with no tags
// field, so /send accepts `tag` for forward compatibility but does not
// forward it upstream; `status: "about_to_send"` creates AND sends.

const BUTTONDOWN_API = 'https://api.buttondown.email/v1';
const DEFAULT_TAG = 'allternit-news';

// Same pattern Buttondown's own spec uses for email_address (max length 254).
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

function notConfigured() {
  return json({ ok: false, error: 'newsletter not configured' }, 503);
}

function buttondown(env, path, payload, extraHeaders = {}) {
  return fetch(`${BUTTONDOWN_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  });
}

async function handleSubscribe(request, env) {
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'missing or invalid email' }, 400);
  }
  if (!env.BUTTONDOWN_API_KEY) return notConfigured();

  const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim() : DEFAULT_TAG;

  let res;
  try {
    res = await buttondown(env, '/subscribers', { email_address: email, tags: [tag] });
  } catch (err) {
    return json({ ok: false, error: `upstream fetch failed: ${err.message}` }, 502);
  }

  if (res.status === 201) return json({ ok: true });
  if (res.status === 409) return json({ ok: true }); // already subscribed

  const detail = await res.text();
  return json({ ok: false, error: `upstream HTTP ${res.status}: ${detail.slice(0, 200)}` }, 502);
}

async function handleSend(request, env) {
  if (
    !env.NEWSLETTER_SEND_TOKEN ||
    request.headers.get('x-relay-token') !== env.NEWSLETTER_SEND_TOKEN
  ) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const body = await readJson(request);
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body?.html === 'string' ? body.html : '';
  if (!subject || !html) {
    return json({ ok: false, error: 'missing subject or html' }, 400);
  }
  if (!env.BUTTONDOWN_API_KEY) return notConfigured();

  let res;
  try {
    res = await buttondown(
      env,
      '/emails',
      { subject, body: html, status: 'about_to_send' },
      // Buttondown requires this opt-in header for immediate sends.
      { 'X-Buttondown-Live-Dangerously': 'true' },
    );
  } catch (err) {
    return json({ ok: false, error: `upstream fetch failed: ${err.message}` }, 502);
  }

  const text = await res.text();
  if (!res.ok) {
    return json({ ok: false, error: `upstream HTTP ${res.status}: ${text.slice(0, 200)}` }, 502);
  }
  try {
    return json(JSON.parse(text), res.status);
  } catch {
    return json({ ok: false, error: 'bad upstream JSON' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') return new Response('ok');

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      return handleSubscribe(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/send') {
      return handleSend(request, env);
    }

    return new Response('not found', { status: 404 });
  },
};
