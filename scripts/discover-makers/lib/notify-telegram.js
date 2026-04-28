'use strict';

/**
 * Telegram notification helper — calls the existing ergsn-tg Worker
 * (cool-meadow-ergsn-tg-655a.ceodon.workers.dev) with the same Origin
 * the rest of ERGSN uses, so the worker's ALLOW_ORIGIN whitelist passes.
 *
 * Reference: memory/feedback_url_registration_contact_notify.md
 *   "POST summary to Telegram worker with `Origin: https://ergsn.net`"
 *
 * Notifications are best-effort: a network/CORS/credential failure
 * never blocks the underlying review-server action.
 */

const TG_PROXY_URL = 'https://cool-meadow-ergsn-tg-655a.ceodon.workers.dev';
const ORIGIN = 'https://ergsn.net';
const TIMEOUT_MS = 6000;

async function sendText(text) {
  if (!text) return { ok: false, error: 'empty text' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TG_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN,
        'User-Agent': 'ERGSN-review-tool/1.0'
      },
      body: JSON.stringify({ text }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    const body = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 200) };
    return { ok: true, status: res.status };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: e.message };
  }
}

function fmtMaker(m) {
  const lines = [];
  lines.push('✅ *Maker promoted to contacts*');
  lines.push(`• ${m.legalName || m.displayName || m.homepageHost}`);
  lines.push(`• Sector: ${m.sector}`);
  if (m.englishHomepageUrl) lines.push(`• EN: ${m.englishHomepageUrl}`);
  else if (m.koreanHomepageUrl) lines.push(`• KO: ${m.koreanHomepageUrl}`);
  if (m.contact && (m.contact.email || m.contact.tel)) {
    const c = [];
    if (m.contact.email) c.push(`📧 ${m.contact.email}`);
    if (m.contact.tel) c.push(`📞 ${m.contact.tel}`);
    if (m.contact.whatsapp) c.push(`💬 ${m.contact.whatsapp}`);
    if (m.contact.kakaoTalk) c.push(`💛 ${m.contact.kakaoTalk}`);
    lines.push('• ' + c.join(' · '));
  }
  if (m.contractSigned) lines.push(`📝 Contract signed${m.contractDate ? ' (' + m.contractDate + ')' : ''}`);
  return lines.join('\n');
}

function fmtProduct(maker, product) {
  const lines = [];
  lines.push('✅ *Product registered to ergsn.net*');
  lines.push(`• ${product.model}  (${product.id})`);
  lines.push(`• Maker: ${maker.legalName || maker.displayName || maker.homepageHost}`);
  lines.push(`• Sector: ${product.sector}`);
  if (product.specs && product.specs.length) lines.push(`• Specs: ${product.specs.length}, Features: ${product.features?.length || 0}`);
  if (product.priceLow || product.priceHigh) lines.push(`• Price: $${product.priceLow || '?'} – $${product.priceHigh || '?'} FOB`);
  if (product.sourceUrl) lines.push(`• Source: ${product.sourceUrl}`);
  return lines.join('\n');
}

async function notifyPromote(maker) { return sendText(fmtMaker(maker)); }
async function notifyProductRegistered(maker, product) { return sendText(fmtProduct(maker, product)); }

module.exports = { sendText, notifyPromote, notifyProductRegistered };
