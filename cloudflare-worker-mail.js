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

/* ─── Cloudflare Access JWT verification (defense in depth) ───────────────
 * Mirrors the verifier in cloudflare-worker-trade-docs.js. Allows the
 * mail Worker's admin endpoints (/admin-send, /raw) to honor a verified
 * CF Access JWT in addition to the legacy X-Admin-Key. Secrets required:
 *   CF_ACCESS_TEAM = <team-name>     (e.g. "ergsn")
 *   CF_ACCESS_AUD  = <application AUD tag>
 * Both are public identifiers (not actual secrets) — bound via wrangler. */
let _jwksCache = null;
const JWKS_TTL_MS = 60 * 60 * 1000;
async function fetchJwks(team) {
  if (_jwksCache && (Date.now() - _jwksCache.fetchedAt) < JWKS_TTL_MS) return _jwksCache.keys;
  const r = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('JWKS fetch failed: ' + r.status);
  const data = await r.json();
  _jwksCache = { keys: data.keys || [], fetchedAt: Date.now() };
  return _jwksCache.keys;
}
function _b64urlBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function _b64urlJson(s) { return JSON.parse(new TextDecoder().decode(_b64urlBytes(s))); }
async function verifyAccessJwt(token, env) {
  if (!env.CF_ACCESS_TEAM || !env.CF_ACCESS_AUD) throw new Error('CF Access secrets not configured');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed JWT');
  const header = _b64urlJson(parts[0]);
  const payload = _b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('unexpected alg');
  if (!header.kid) throw new Error('no kid');
  const keys = await fetchJwks(env.CF_ACCESS_TEAM);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('no JWKS key for kid');
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, _b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) throw new Error('signature invalid');
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('expired');
  if (typeof payload.iat === 'number' && payload.iat > now + 60) throw new Error('iat in future');
  if (payload.iss !== `https://${env.CF_ACCESS_TEAM}.cloudflareaccess.com`) throw new Error('bad iss');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.CF_ACCESS_AUD)) throw new Error('aud mismatch');
  if (!payload.email) throw new Error('no email claim');
  return { email: String(payload.email).toLowerCase(), sub: payload.sub || null };
}
async function adminAuth(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || request.headers.get('cf-access-jwt-assertion') || '';
  if (jwt) {
    try { const { email } = await verifyAccessJwt(jwt, env); return { ok: true, source: 'cf-access', email }; }
    catch (_) { return { ok: false, error: 'invalid CF Access JWT' }; }
  }
  const key = request.headers.get('X-Admin-Key') || '';
  if (env.ADMIN_KEY && key === env.ADMIN_KEY) return { ok: true, source: 'admin-key', email: null };
  return { ok: false, error: 'unauthorized' };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowList = (env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
    const wildcard = allowList.includes('*');
    const isErgsn = /^https:\/\/([a-z0-9-]+\.)?ergsn\.net$/i.test(origin);
    const matched = wildcard ? '*' : (allowList.includes(origin) || isErgsn ? origin : '');
    const cors = {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, Cf-Access-Jwt-Assertion',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (matched) {
      cors['Access-Control-Allow-Origin'] = matched;
      /* Credentials cannot pair with the wildcard origin per CORS spec. */
      if (matched !== '*') cors['Access-Control-Allow-Credentials'] = 'true';
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    /* Strip the same-origin Admin Hub mount prefix so admin.ergsn.net/api/mail/*
       and the legacy *.workers.dev path-space share one router. */
    let pathname = url.pathname;
    if (pathname === '/api/mail' || pathname === '/api/mail/') pathname = '/';
    else if (pathname.startsWith('/api/mail/')) pathname = pathname.slice('/api/mail'.length);
    const path = pathname.replace(/\/$/, '') || '/';

    /* Liveness probe — public, no auth, no body. Powers the worker health
       pin in admin-header.js + admin-footer.js. Place BEFORE the POST-only
       gate so a GET reaches it. */
    if (request.method === 'GET' && (path === '/health' || path === '/')) {
      return jsonResponse({ ok: true, name: 'ergsn-mail', alive: true }, 200, cors);
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    /* /raw bypasses CORS origin check because it's admin-only via header. */
    if (path !== '/raw' && !matched) {
      return jsonResponse({ ok: false, error: 'origin not allowed' }, 403, cors);
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'invalid JSON' }, 400, cors); }

    if (path === '/send') return handleSend(body, env, cors);
    if (path === '/raw')  return handleRaw(body, env, cors, request);
    if (path === '/admin-send') {
      /* Same brand-wrap as /send, gated by dual-auth (CF Access JWT or
         legacy X-Admin-Key). Used by the owner-only send-mail.html
         composer so a leaked URL alone can't spray spam through the
         relay. JWT path verifies signature, iss, aud, exp at the edge. */
      const auth = await adminAuth(request, env);
      if (!auth.ok) {
        return jsonResponse({ ok: false, error: auth.error || 'unauthorized' }, 401, cors);
      }
      return handleSend(body, env, cors);
    }
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
  const locale    = (body.locale === 'ko' || body.lang === 'ko') ? 'ko' : 'en';
  const defaultFromName = locale === 'ko' ? 'ERGSN 무역센터' : 'ERGSN Trade Desk';
  const fromName  = String(body.fromName || defaultFromName).slice(0, 100);
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

  const wrappedHtml = wrapInTemplate(htmlBody, subject, locale);

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
  /* Dual-auth: CF Access JWT preferred, X-Admin-Key as recovery. */
  const auth = await adminAuth(request, env);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error || 'unauthorized' }, 401, cors);
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
        /* charset=utf-8 explicit so Resend never falls back to a
           guessed encoding — Korean glyphs were rendering as mojibake
           in some clients without it. */
        'Content-Type': 'application/json; charset=utf-8'
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
 * 720px max-width to match the Gmail/Outlook reading pane so the
 * branded card doesn't look narrower than the From/To/Date row above.
 * Dark masthead/footer + light body. Logo uses per-letter spans +
 * font-kerning:none (see feedback_logo_kerning_policy memory).
 * Localised: English (default) or Korean (pass `locale: "ko"` in the
 * /send payload). Only surrounding chrome localises — the caller-
 * provided `htmlBody` is inserted verbatim.
 * ================================================================== */

/* Logo markup helper — identical shape on every surface, only font-size
   and letter-spacing differ. Keep sync with feedback_logo_kerning_policy. */
function logoInline(fontSize, color) {
  const eColor = '#34d298';
  return `<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:${fontSize}px;font-weight:800;letter-spacing:.04em;color:${color};text-transform:uppercase;line-height:1;font-kerning:none;-webkit-font-feature-settings:'kern' 0;font-feature-settings:'kern' 0;">` +
    `<span style="color:${eColor};">E</span><span>R</span><span>G</span><span>S</span><span>N</span>` +
  `</span>`;
}

/* All glyphs below are direct UTF-8 characters (no HTML entities) so
   email clients render them consistently across charset detection
   paths. `·` not `&middot;`, `’` not `&rsquo;`, `©` not `&copy;`. */
const I18N = {
  en: {
    tagline:    "Korea’s Trusted<br>Trade Gateway",
    reach:      "Trade Desk:",
    contacts:   '<a href="https://t.me/ceodon" style="color:#0f0f0f;text-decoration:none;font-weight:700;">Telegram</a>' +
                ' · <a href="https://wa.me/821052880006" style="color:#0f0f0f;text-decoration:none;font-weight:700;">WhatsApp</a>',
    address:    "#503 Susong BD, 12-21, Seoae-ro 5-gil, Joong-gu, Seoul 04623, Republic of Korea",
    privacy:    "Privacy",
    terms:      "Terms",
    copy:       "© 2013 ERGSN CO., LTD. All rights reserved."
  },
  ko: {
    tagline:    "한국 신뢰 무역<br>플랫폼",
    reach:      "고객지원:",
    contacts:   '<a href="https://t.me/ceodon" style="color:#0f0f0f;text-decoration:none;font-weight:700;">텔레그램</a>' +
                ' · <a href="https://wa.me/821052880006" style="color:#0f0f0f;text-decoration:none;font-weight:700;">왓츠앱</a>' +
                ' · <a href="https://pf.kakao.com/_AxowjX" style="color:#0f0f0f;text-decoration:none;font-weight:700;">카카오톡</a>',
    address:    "서울특별시 중구 서애로5길 12-21 수송빌딩 #503 (04623)",
    privacy:    "개인정보처리방침",
    terms:      "이용약관",
    copy:       "© 2013 ERGSN 주식회사. All rights reserved."
  }
};

function wrapInTemplate(bodyHtml, subject, locale) {
  const L = I18N[locale] || I18N.en;
  const safeTitle = escapeHtml(subject || 'ERGSN');
  const htmlLang = locale === 'ko' ? 'ko' : 'en';
  return `<!doctype html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#333;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(stripHtml(bodyHtml).slice(0, 120))}</div>
<!-- Card spans the entire reading pane: no outer gutter or background tint,
     no rounded corners, no shadow. Header/footer dark bands provide the only
     visual chrome; body is pure white edge-to-edge so it matches whatever
     width the mail client allocates. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
  <tr><td style="padding:4px;">
    <!-- Outer card chrome lives on a <div>, NOT on the table. Gmail (web,
         Android, iOS) strips border-radius / overflow:hidden when applied to
         <table>; the same rules survive on <div>. So:
           div  → border + radius + overflow:hidden + outer card paint
           table → flat layout grid for the rows (header / body / footer)
         Outlook desktop ignores border-radius on the div too, but renders
         the inner table normally — so the worst-case fallback is a square
         card with the same colours. Every other client gets the rounded
         12px chamfer with the dark outline tied at the corners.
         Outer <td> padding kept at 4px (the minimum that still lets the
         12px chamfer be visible) so the card stretches almost edge-to-edge
         in the reading pane. Smaller padding clips the chamfer entirely. -->
    <div style="background:#ffffff;border:2px solid #0f0f0f;border-radius:12px;overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-collapse:collapse;">

      <!-- Header / masthead — logo wraps in <a> so click goes to ergsn.net -->
      <tr>
        <td style="background:#0f0f0f;padding:18px 28px;border-bottom:3px solid #34d298;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td><a href="https://ergsn.net" style="text-decoration:none;display:inline-block;">${logoInline(18, '#ffffff')}</a></td>
              <td align="right" style="font-size:10.5px;color:#a7a7a7;letter-spacing:.06em;line-height:1.4;">${L.tagline}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body — caller HTML inserted verbatim -->
      <tr>
        <td style="padding:26px 32px;font-size:12px;line-height:1.7;color:#333;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:0;border-top:1px solid #e5e5e5;margin:0;"></td></tr>

      <!-- CTA strip — locale supplies the chip block. EN: TG+WA, KO: TG+WA+Kakao -->
      <tr>
        <td style="padding:16px 32px;font-size:11.5px;color:#6b7685;line-height:1.7;">
          ${L.reach} ${L.contacts}
        </td>
      </tr>

      <!-- Footer — wordmark only, all text in the same #8a8b8d grey for visual unity.
           Every text <p> below the logo carries the SAME font-size, line-height,
           and margin so PC + mobile leading look identical (mobile clients were
           inheriting the default leading and rendering tighter than PC). The
           logo row keeps its own slightly looser leading. -->
      <tr>
        <td style="background:#0f0f0f;padding:20px 32px;">
          <p style="margin:0 0 12px;font-size:11px;line-height:1.7;color:#8a8b8d;">${logoInline(14, '#ffffff')}</p>
          <!-- Address wrapped in a no-op anchor + cursor:default + pointer-events:none
               so Gmail/Apple Mail do NOT auto-detect it and turn the line into a
               Google Maps hyperlink (the wrapper signals "already linked, leave it"). -->
          <p style="margin:0 0 6px;font-size:10px;line-height:1.6;color:#8a8b8d;"><a href="#" style="color:#8a8b8d;text-decoration:none;cursor:default;pointer-events:none;-webkit-tap-highlight-color:transparent;line-height:1.6;">${L.address}</a></p>
          <p style="margin:0;font-size:10px;line-height:1.6;color:#8a8b8d;">
            ${L.copy}
            · <a href="https://ergsn.net/privacy.html" style="color:#8a8b8d;text-decoration:underline;line-height:1.6;">${L.privacy}</a>
            · <a href="https://ergsn.net/terms.html" style="color:#8a8b8d;text-decoration:underline;line-height:1.6;">${L.terms}</a>
          </p>
        </td>
      </tr>

    </table>
    </div>
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
