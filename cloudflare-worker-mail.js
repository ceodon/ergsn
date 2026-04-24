/**
 * ERGSN Mail Worker — branded transactional email via Resend
 *
 * Sends ERGSN-branded HTML email through the Resend API. Wraps the
 * caller's HTML body in a navy + neon-green template with masthead
 * logo, address block, and Telegram/WhatsApp links so every outbound
 * message looks like the same brand.
 *
 * NOTE 2026-04-25: previous version targeted MailChannels which ended
 * its free Cloudflare Workers plan in 2024-06. Switched to Resend
 * (free tier 100/day · 3000/month, sufficient for ERGSN volume).
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
 *     Response: { ok: true, id } on success, { ok: false, error, ... } on fail.
 *
 *   POST /raw        — admin-only (X-Admin-Key). Bypasses brand wrap.
 *                      For owner-side admin tasks; never call from browser.
 *
 * ----------------------------------------------------------------------
 * SECRETS (Cloudflare → Worker → Settings → Variables and Secrets)
 *
 *   RESEND_API_KEY — Resend API key (re_...)
 *   ALLOW_ORIGIN   — comma list, e.g. "https://ergsn.net,https://ceodon.github.io"
 *   ADMIN_KEY      — long random string for the /raw endpoint
 *
 * ----------------------------------------------------------------------
 * RESEND DOMAIN VERIFICATION (one-time, owner action)
 *
 *   1. resend.com → Sign up
 *   2. Domains → Add Domain → "ergsn.net"
 *   3. Add the four DNS records Resend shows (SPF + 3× DKIM) to
 *      Cloudflare DNS (Websites → ergsn.net → DNS → Records)
 *   4. Click Verify in Resend (waits for DNS propagation, ~5 min)
 *   5. API Keys → Create API Key → name "ergsn-mail-worker" → copy
 *
 * ----------------------------------------------------------------------
 * HEALTH CHECK
 *
 *   curl -X POST -H "Origin: https://ergsn.net" \
 *        -H "Content-Type: application/json" \
 *        -d '{"to":"ceodon@gmail.com","subject":"ERGSN test",
 *             "htmlBody":"<p>Hello</p>"}' \
 *        https://ergsn-mail.<sub>.workers.dev/send
 *   Expect: HTTP 200 + {"ok":true,"id":"..."} and the email lands in
 *   inbox (or spam if DNS verification incomplete).
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

  return sendThroughResend({
    fromEmail, fromName,
    to: recipients,
    cc: cc || null,
    replyTo,
    subject,
    html: wrappedHtml,
    text: textBody
  }, env, cors);
}

/* ==================================================================
 * /raw — admin-only, no template wrap (for transactional internals)
 * ================================================================== */
async function handleRaw(body, env, cors, request) {
  const key = request.headers.get('X-Admin-Key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401, cors);
  }
  /* Caller is fully responsible for the Resend payload shape — passed
     through as-is. Use this only when the brand wrap is in the way
     (e.g. plaintext receipts, vendor-facing system emails). */
  return sendRawResend(body, env, cors);
}

/* ==================================================================
 * Resend relay
 * ================================================================== */
async function sendThroughResend({ fromEmail, fromName, to, cc, replyTo, subject, html, text }, env, cors) {
  if (!env.RESEND_API_KEY) {
    return jsonResponse({ ok: false, error: 'RESEND_API_KEY not configured' }, 500, cors);
  }

  const resendBody = {
    from:    fromName ? `${fromName} <${fromEmail}>` : fromEmail,
    to:      to.map(r => r.email),
    subject,
    html,
    text
  };
  if (cc && cc.length) resendBody.cc = cc.map(r => r.email);
  if (replyTo) {
    const r = (typeof replyTo === 'string') ? replyTo : replyTo.email;
    if (r) resendBody.reply_to = r;
  }

  return callResend(resendBody, env, cors);
}

async function sendRawResend(rawBody, env, cors) {
  if (!env.RESEND_API_KEY) {
    return jsonResponse({ ok: false, error: 'RESEND_API_KEY not configured' }, 500, cors);
  }
  return callResend(rawBody, env, cors);
}

async function callResend(body, env, cors) {
  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: 'fetch failed', detail: String(e).slice(0, 300) }, 502, cors);
  }
  if (r.ok) {
    const data = await r.json().catch(() => ({}));
    return jsonResponse({ ok: true, id: data.id || null }, 200, cors);
  }
  const detail = await r.text().catch(() => '');
  return jsonResponse(
    { ok: false, error: 'resend rejected', status: r.status, detail: detail.slice(0, 500) },
    502,
    cors
  );
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
