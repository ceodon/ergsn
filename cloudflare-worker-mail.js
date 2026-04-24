/**
 * ERGSN Mail Worker — branded transactional email via MailChannels
 *
 * Sends ERGSN-branded HTML email through Cloudflare's free MailChannels
 * relay. Wraps the caller's HTML body in a navy + neon-green template
 * with masthead logo, address block, and Telegram/WhatsApp links so
 * every outbound message looks like the same brand.
 *
 * ----------------------------------------------------------------------
 * ENDPOINTS
 *
 *   POST /send       — public (CORS-gated). Wraps body in brand template.
 *     Request JSON:
 *       {
 *         to:           "buyer@example.com" | [{ email, name? }, ...],
 *         subject:      "Your ERGSN RFQ — confirmation",
 *         htmlBody:     "<p>your inner HTML</p>",
 *         textBody?:    "plain text fallback (auto-stripped if omitted)",
 *         from?:        "noreply@ergsn.net"  // must use ergsn.net domain
 *         fromName?:    "ERGSN Trade Desk",
 *         replyTo?:     "ceodon@gmail.com" | { email, name },
 *         cc?:          [{ email, name? }, ...]
 *       }
 *     Response: { ok: true } on success, { ok: false, error, ... } on fail.
 *
 *   POST /raw        — admin-only (X-Admin-Key). Bypasses brand wrap.
 *                      For owner-side admin tasks; never call from browser.
 *
 * ----------------------------------------------------------------------
 * SECRETS (Cloudflare → Worker → Settings → Variables and Secrets)
 *
 *   ALLOW_ORIGIN — comma list, e.g. "https://ergsn.net,https://ceodon.github.io"
 *   ADMIN_KEY    — long random string for the /raw endpoint
 *
 * ----------------------------------------------------------------------
 * DNS — required for MailChannels to accept ergsn.net `from`:
 *
 *   1) SPF (single TXT record at apex):
 *        Type: TXT
 *        Name: @  (or ergsn.net)
 *        Value: v=spf1 include:relay.mailchannels.net ~all
 *
 *      If a SPF record already exists, MERGE — do not create a second
 *      v=spf1 record (only one is allowed per domain). Insert
 *      `include:relay.mailchannels.net` into the existing record.
 *
 *   2) Domain Lockdown (recommended — prevents others from sending as
 *      ergsn.net through MailChannels):
 *        Type: TXT
 *        Name: _mailchannels
 *        Value: v=mc1 cfid=<your-account-subdomain>.workers.dev
 *
 *   3) DKIM (optional but boosts inbox placement) — generate keys via
 *      `openssl genrsa 2048` + add `_domainkey.ergsn.net` TXT.
 *      Skip on first deploy; revisit if Gmail/Outlook flags as spam.
 *
 * ----------------------------------------------------------------------
 * DEPLOY
 *
 *   1. CF Dashboard → Workers & Pages → Create Worker → name "ergsn-mail"
 *   2. Code: paste this entire file → Save and deploy
 *   3. Settings → Variables and Secrets → add ALLOW_ORIGIN + ADMIN_KEY
 *   4. Add the SPF DNS record above
 *   5. Health check (with origin set so CORS gate passes):
 *        curl -X POST -H "Origin: https://ergsn.net" \
 *             -H "Content-Type: application/json" \
 *             -d '{"to":"ceodon@gmail.com","subject":"ERGSN mail worker test",
 *                  "htmlBody":"<p>Hello from <strong>ERGSN</strong></p>"}' \
 *             https://ergsn-mail.<your-sub>.workers.dev/send
 *      Expect: HTTP 200 + {"ok":true}, and the email lands in your inbox.
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowList = (env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
    const wildcard = allowList.includes('*');
    const matched = wildcard ? '*' : (allowList.includes(origin) ? origin : '');
    const cors = {
      'Access-Control-Allow-Origin': matched,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    /* /raw bypasses CORS origin check because it's admin-only via header. */
    if (path !== '/raw' && !matched) {
      return jsonResponse({ ok: false, error: 'origin not allowed' }, 403, cors);
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'invalid JSON' }, 400, cors); }

    if (path === '/send') return handleSend(body, env, cors);
    if (path === '/raw')  return handleRaw(body, env, cors, request);
    return jsonResponse({ ok: false, error: 'not found' }, 404, cors);
  }
};

/* ==================================================================
 * /send — public branded email (CORS-gated, no admin secret required)
 * ================================================================== */
async function handleSend(body, env, cors) {
  const to        = body.to;
  const subject   = String(body.subject || '').slice(0, 200);
  const htmlBody  = String(body.htmlBody || '');
  const textBody  = body.textBody ? String(body.textBody) : stripHtml(htmlBody);
  const fromEmail = isErgsnDomain(body.from) ? body.from : 'noreply@ergsn.net';
  const fromName  = String(body.fromName || 'ERGSN Trade Desk').slice(0, 100);
  const replyTo   = body.replyTo || null;
  const cc        = Array.isArray(body.cc) ? body.cc : null;

  if (!to)       return jsonResponse({ ok: false, error: '`to` required' }, 400, cors);
  if (!subject)  return jsonResponse({ ok: false, error: '`subject` required' }, 400, cors);
  if (!htmlBody) return jsonResponse({ ok: false, error: '`htmlBody` required' }, 400, cors);

  const recipients = normaliseRecipients(to);
  if (!recipients) return jsonResponse({ ok: false, error: 'invalid `to` address' }, 400, cors);
  if (cc && cc.some(r => !isValidEmail(r.email))) {
    return jsonResponse({ ok: false, error: 'invalid `cc` address' }, 400, cors);
  }

  const wrappedHtml = wrapInTemplate(htmlBody, subject);

  const payload = buildMailChannelsPayload({
    from:    { email: fromEmail, name: fromName },
    to:      recipients,
    cc:      cc || undefined,
    subject,
    html:    wrappedHtml,
    text:    textBody,
    replyTo: replyTo
  });

  return sendThroughMailChannels(payload, cors);
}

/* ==================================================================
 * /raw — admin-only, no template wrap (for transactional internals)
 * ================================================================== */
async function handleRaw(body, env, cors, request) {
  const key = request.headers.get('X-Admin-Key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401, cors);
  }
  /* Caller is fully responsible for the MailChannels payload shape. */
  return sendThroughMailChannels(body, cors);
}

/* ==================================================================
 * MailChannels relay
 * ================================================================== */
async function sendThroughMailChannels(payload, cors) {
  let r;
  try {
    r = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: 'fetch failed', detail: String(e).slice(0, 300) }, 502, cors);
  }
  if (r.ok) return jsonResponse({ ok: true }, 200, cors);
  const detail = await r.text().catch(() => '');
  return jsonResponse(
    { ok: false, error: 'mailchannels rejected', status: r.status, detail: detail.slice(0, 500) },
    502,
    cors
  );
}

function buildMailChannelsPayload({ from, to, cc, subject, html, text, replyTo }) {
  const personalisation = { to: to };
  if (cc && cc.length) personalisation.cc = cc;
  const content = [];
  if (text) content.push({ type: 'text/plain', value: text });
  if (html) content.push({ type: 'text/html',  value: html });
  const payload = {
    personalizations: [personalisation],
    from,
    subject,
    content
  };
  if (replyTo) {
    payload.reply_to = typeof replyTo === 'string' ? { email: replyTo } : replyTo;
  }
  return payload;
}

/* ==================================================================
 * ERGSN brand template — single source of truth
 * Inline-styled HTML (no external CSS — most mail clients strip <style>).
 * Designed for 600px width, dark masthead/footer + light body for
 * legibility, navy + neon-green token set matching ergsn.net.
 * ================================================================== */
function wrapInTemplate(bodyHtml, subject) {
  const safeTitle = escapeHtml(subject || 'ERGSN');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#333;line-height:1.65;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(stripHtml(bodyHtml).slice(0, 120))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:24px 0;">
  <tr><td align="center" style="padding:0 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

      <!-- Header / masthead -->
      <tr>
        <td style="background:#0f0f0f;padding:24px 32px;border-bottom:3px solid #34d298;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:.12em;color:#ffffff;text-transform:uppercase;line-height:1;">
                <span style="color:#34d298;">E</span>RGSN
              </td>
              <td align="right" style="font-size:11px;color:#a7a7a7;letter-spacing:.08em;line-height:1.4;">
                Korea&rsquo;s Trusted<br>Trade Gateway
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body — caller HTML inserted verbatim -->
      <tr>
        <td style="padding:32px;font-size:14.5px;line-height:1.7;color:#333;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:0;border-top:1px solid #e5e5e5;margin:0;"></td></tr>

      <!-- CTA strip -->
      <tr>
        <td style="padding:20px 32px;font-size:12.5px;color:#6b7685;line-height:1.7;">
          Reach the trade desk:
          &nbsp;<a href="https://t.me/ceodon" style="color:#0f0f0f;text-decoration:none;font-weight:700;">Telegram</a>
          &nbsp;&middot;&nbsp;<a href="https://wa.me/821052880006" style="color:#0f0f0f;text-decoration:none;font-weight:700;">WhatsApp</a>
          &nbsp;&middot;&nbsp;<a href="https://ergsn.net" style="color:#0f0f0f;text-decoration:none;font-weight:700;">ergsn.net</a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0f0f0f;padding:24px 32px;color:#8a8b8d;font-size:11.5px;line-height:1.7;">
          <p style="margin:0 0 8px;color:#cfcfcf;font-weight:600;">ERGSN CO., LTD.</p>
          <p style="margin:0 0 4px;">#503 Susong BD, 12-21, Seoae-ro 5-gil, Joong-gu, Seoul 04623, Republic of Korea</p>
          <p style="margin:0 0 12px;">
            <a href="https://ergsn.net" style="color:#34d298;text-decoration:none;">ergsn.net</a>
            &middot; <a href="https://ergsn.net/privacy.html" style="color:#34d298;text-decoration:none;">Privacy</a>
            &middot; <a href="https://ergsn.net/terms.html" style="color:#34d298;text-decoration:none;">Terms</a>
          </p>
          <p style="margin:0;font-size:10.5px;color:#6b7685;">
            &copy; 2013 ERGSN CO., LTD. All rights reserved &middot; Made in Korea
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ==================================================================
 * Helpers
 * ================================================================== */
function normaliseRecipients(to) {
  const arr = Array.isArray(to) ? to : [{ email: to }];
  const out = [];
  for (const r of arr) {
    const obj = (typeof r === 'string') ? { email: r } : r;
    if (!isValidEmail(obj.email)) return null;
    out.push({ email: obj.email, ...(obj.name ? { name: String(obj.name).slice(0, 100) } : {}) });
  }
  return out;
}

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isErgsnDomain(addr) {
  return typeof addr === 'string' && /@ergsn\.net$/i.test(addr);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripHtml(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function jsonResponse(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
