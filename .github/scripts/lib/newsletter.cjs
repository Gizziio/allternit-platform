#!/usr/bin/env node
/**
 * Allternit Newsletter — Email Builder & Sender
 *
 * buildNewsletterEmail(publication) → { subject, html }
 *   Email-safe HTML document for a Publication, ported from
 *   www.allternit.com/source/app/src/lib/newsletter.ts (signal + feature
 *   templates). Brand colors and layout are faithful to the original, with
 *   two deliberate email-safety fixes:
 *     - the TS source interpolated `${BRAND_COLORS.*}` inside single-quoted
 *       strings (a no-op bug — the literal text reached the HTML); here the
 *       real hex values are inlined.
 *     - `var(--font-research)` / `var(--font-ui)` are replaced by the concrete
 *       font stacks they resolve to (email clients don't load the site's CSS
 *       custom properties).
 *   "Read online" links to publication.artifactUrl when present, else
 *   https://allternit.com/news.
 *
 * sendNewsletter(publication) → boolean
 *   POSTs the built email to the allternit-newsletter Cloudflare worker
 *   (/send, x-relay-token auth). Clean-skips (log + return false) when
 *   NEWSLETTER_SEND_TOKEN is unset. Never throws on network/upstream failure.
 *
 * Env: NEWSLETTER_SEND_TOKEN (required to send), NEWSLETTER_WORKER_URL
 *      (optional override, defaults to the production worker).
 */

const NEWSLETTER_WORKER_URL =
  process.env.NEWSLETTER_WORKER_URL || 'https://allternit-newsletter.allternitpbc.workers.dev';

const BRAND_COLORS = {
  coral: '#E85A4F',
  dark: '#1A1A1A',
  cream: '#F5F2ED',
  textMuted: '#6B6560',
  cardBeige: '#EDEAE4',
  white: '#FFFFFF',
};

// Concrete stacks behind the site's var(--font-ui) / var(--font-research).
const FONT_SANS =
  "'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_SERIF = "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', serif";

function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtmlEmail(markdown) {
  // Simple markdown → HTML conversion for email
  let html = escapeHtml(markdown);

  // Headers
  html = html.replace(/^### (.*$)/gim, `<h3 style="font-family:${FONT_SERIF};font-size:18px;color:${BRAND_COLORS.dark};margin:24px 0 12px;font-weight:normal;">$1</h3>`);
  html = html.replace(/^## (.*$)/gim, `<h2 style="font-family:${FONT_SERIF};font-size:22px;color:${BRAND_COLORS.dark};margin:32px 0 16px;font-weight:normal;">$1</h2>`);
  html = html.replace(/^# (.*$)/gim, `<h1 style="font-family:${FONT_SERIF};font-size:28px;color:${BRAND_COLORS.dark};margin:0 0 20px;font-weight:normal;line-height:1.2;">$1</h1>`);

  // Bold/italic
  html = html.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${BRAND_COLORS.dark};">$1</strong>`);
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:${BRAND_COLORS.coral};text-decoration:none;">$1</a>`);

  // Lists
  html = html.replace(/^\* (.*$)/gim, `<li style="margin:6px 0;color:${BRAND_COLORS.textMuted};font-size:15px;line-height:1.6;">$1</li>`);
  html = html.replace(/(<li.*<\/li>\n)+/g, `<ul style="padding-left:20px;margin:12px 0;">$&</ul>`);

  // Blockquotes
  html = html.replace(/^&gt; (.*$)/gim, `<blockquote style="border-left:3px solid ${BRAND_COLORS.coral};padding-left:16px;margin:16px 0;color:${BRAND_COLORS.textMuted};font-style:italic;">$1</blockquote>`);

  // Horizontal rules
  html = html.replace(/^---$/gim, `<hr style="border:none;border-top:1px solid ${BRAND_COLORS.cardBeige};margin:24px 0;">`);

  // Paragraphs
  html = html.replace(/\n\n/g, `</p><p style="color:${BRAND_COLORS.textMuted};font-size:15px;line-height:1.7;margin:0 0 16px;">`);
  html = `<p style="color:${BRAND_COLORS.textMuted};font-size:15px;line-height:1.7;margin:0 0 16px;">` + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');

  return html;
}

function baseEmailTemplate(options) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(options.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .headline { font-size: 24px !important; }
      .stats-grid { display: block !important; }
      .stats-grid td { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_COLORS.cream};font-family:${FONT_SANS};">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(options.preheader)}</div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="margin:0 auto;background:${BRAND_COLORS.white};border-radius:16px;overflow:hidden;border:1px solid #E5E2DD;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid ${BRAND_COLORS.cardBeige};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display:inline-block;background:${options.accentColor}15;color:${options.accentColor};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding:4px 10px;border-radius:20px;margin-bottom:12px;">${escapeHtml(options.headerLabel)}</span>
                  </td>
                  <td style="text-align:right;">
                    <a href="https://allternit.com" style="text-decoration:none;">
                      <span style="font-family:${FONT_SERIF};font-size:20px;color:${BRAND_COLORS.dark};font-weight:500;">Allternit</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${options.body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:${BRAND_COLORS.cream};border-top:1px solid ${BRAND_COLORS.cardBeige};">
              ${options.footer}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatDate(pub) {
  return new Date(pub.publishedAt || pub.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// "Read online" target: the publication's own artifact when it has one,
// otherwise the Allternit News index.
function readOnlineUrl(pub) {
  return typeof pub.artifactUrl === 'string' && pub.artifactUrl
    ? pub.artifactUrl
    : 'https://allternit.com/news';
}

function generateSignalEmail(pub) {
  const dateStr = formatDate(pub);
  const url = readOnlineUrl(pub);

  const body = `
  <p style="color:${BRAND_COLORS.textMuted};font-size:13px;margin:0 0 24px;">${dateStr}</p>

  <h1 class="headline" style="font-family:${FONT_SERIF};font-size:28px;color:${BRAND_COLORS.dark};margin:0 0 16px;font-weight:normal;line-height:1.2;">${escapeHtml(pub.title)}</h1>

  <p style="color:${BRAND_COLORS.textMuted};font-size:16px;line-height:1.6;margin:0 0 32px;font-weight:500;">${escapeHtml(pub.subtitle || '')}</p>

  <div style="background:${BRAND_COLORS.cardBeige};border-radius:12px;padding:20px;margin:0 0 32px;">
    <p style="color:${BRAND_COLORS.textMuted};font-size:14px;line-height:1.6;margin:0;font-style:italic;">${escapeHtml(pub.abstract)}</p>
  </div>

  <div style="border-top:1px solid ${BRAND_COLORS.cardBeige};padding-top:24px;">
    ${markdownToHtmlEmail((pub.content && pub.content.markdown) || '')}
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:32px;">
    <tr>
      <td style="text-align:center;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLORS.coral};color:${BRAND_COLORS.white};text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">Read online →</a>
      </td>
    </tr>
  </table>
  `;

  const footer = `
  <p style="color:${BRAND_COLORS.textMuted};font-size:12px;line-height:1.5;margin:0 0 12px;text-align:center;">
    <em>Allternit News is Allternit's weekly newspaper on what matters in AI.</em>
  </p>
  <p style="color:${BRAND_COLORS.textMuted};font-size:11px;line-height:1.5;margin:0;text-align:center;">
    You're receiving this because you subscribed to Allternit Research.<br>
    <a href="https://allternit.com/unsubscribe" style="color:${BRAND_COLORS.textMuted};text-decoration:underline;">Unsubscribe</a> ·
    <a href="https://allternit.com/preferences" style="color:${BRAND_COLORS.textMuted};text-decoration:underline;">Preferences</a> ·
    <a href="${url}" style="color:${BRAND_COLORS.textMuted};text-decoration:underline;">View in browser</a>
  </p>
  `;

  return baseEmailTemplate({
    title: pub.title,
    preheader: pub.subtitle || pub.abstract.substring(0, 120),
    body,
    footer,
    accentColor: '#D97706',
    headerLabel: 'Allternit News',
  });
}

function generateFeatureEmail(pub) {
  const dateStr = formatDate(pub);
  const url = readOnlineUrl(pub);

  const issueLabel = pub.issueNumber ? `Issue ${pub.issueNumber}` : '';
  const seriesLabel = pub.series ? `${pub.series}` : '';
  const metaLabel = [seriesLabel, issueLabel].filter(Boolean).join(' · ');

  const body = `
  <p style="color:${BRAND_COLORS.textMuted};font-size:13px;margin:0 0 8px;">${dateStr}</p>
  ${metaLabel ? `<p style="color:${BRAND_COLORS.coral};font-size:12px;font-weight:600;margin:0 0 24px;letter-spacing:0.05em;">${escapeHtml(metaLabel)}</p>` : ''}

  <h1 class="headline" style="font-family:${FONT_SERIF};font-size:32px;color:${BRAND_COLORS.dark};margin:0 0 16px;font-weight:normal;line-height:1.2;">${escapeHtml(pub.title)}</h1>

  <p style="color:${BRAND_COLORS.textMuted};font-size:16px;line-height:1.6;margin:0 0 24px;font-weight:500;">${escapeHtml(pub.subtitle || '')}</p>

  <div style="background:${BRAND_COLORS.cardBeige};border-radius:12px;padding:20px;margin:0 0 32px;">
    <p style="color:${BRAND_COLORS.textMuted};font-size:14px;line-height:1.6;margin:0;font-style:italic;">${escapeHtml(pub.abstract)}</p>
  </div>

  <div style="border-top:1px solid ${BRAND_COLORS.cardBeige};padding-top:24px;">
    ${markdownToHtmlEmail((pub.content && pub.content.markdown) || '')}
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:32px;">
    <tr>
      <td style="text-align:center;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLORS.coral};color:${BRAND_COLORS.white};text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">Continue reading online →</a>
      </td>
    </tr>
  </table>
  `;

  const footer = `
  <p style="color:${BRAND_COLORS.textMuted};font-size:12px;line-height:1.5;margin:0 0 12px;text-align:center;">
    <em>A://SUDO Reality is Allternit's weekly magazine of deep dives that matter.</em>
  </p>
  <p style="color:${BRAND_COLORS.textMuted};font-size:11px;line-height:1.5;margin:0;text-align:center;">
    You're receiving this because you subscribed to Allternit Research.<br>
    <a href="https://allternit.com/unsubscribe" style="color:${BRAND_COLORS.textMuted};text-decoration:underline;">Unsubscribe</a> ·
    <a href="https://allternit.com/preferences" style="color:${BRAND_COLORS.textMuted};text-decoration:underline;">Preferences</a> ·
    <a href="${url}" style="color:${BRAND_COLORS.textMuted};text-decoration:underline;">View in browser</a>
  </p>
  `;

  return baseEmailTemplate({
    title: pub.title,
    preheader: pub.subtitle || pub.abstract.substring(0, 120),
    body,
    footer,
    accentColor: '#4F46E5',
    headerLabel: 'A://SUDO Reality',
  });
}

function buildNewsletterEmail(publication) {
  const html =
    publication.contentType === 'feature'
      ? generateFeatureEmail(publication)
      : generateSignalEmail(publication);
  return { subject: publication.title, html };
}

async function sendNewsletter(publication) {
  // Read at call time, not require time, so env setup order doesn't matter.
  const token = process.env.NEWSLETTER_SEND_TOKEN || '';
  if (!token) {
    console.log('[newsletter] NEWSLETTER_SEND_TOKEN unset — skipping send');
    return false;
  }

  const { subject, html } = buildNewsletterEmail(publication);

  let res;
  try {
    res = await fetch(`${NEWSLETTER_WORKER_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-token': token,
      },
      body: JSON.stringify({ subject, html }),
    });
  } catch (err) {
    console.error(`[newsletter] send failed: ${err.message}`);
    return false;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[newsletter] send failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    return false;
  }

  console.log(`[newsletter] sent: ${subject}`);
  return true;
}

module.exports = { buildNewsletterEmail, sendNewsletter };
