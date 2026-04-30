'use strict';

/**
 * Per-buyer cold-mail composer.
 *
 * Uses CF Workers AI (Anthropic Haiku fallback) to generate a personalized
 * proposal-style email for each buyer entry, citing ERGSN's flagship case
 * study (DL Series shredders, 13yr Capital Shredder Corp partnership,
 * GSA Schedule listed).
 *
 * Output: { subject, htmlBody, textBody, complianceFooter, fromEmail }.
 *
 * The output lands in data/buyer-outbox/<id>.json and is NEVER auto-sent.
 * A human approval gate (review-server.js → "Send" button OR send.js
 * --confirm) is the only path to actually fire mail through ergsn-mail.
 *
 * Compliance baked in:
 *  - Real physical address (CAN-SPAM)
 *  - Plain-text alt body (CAN-SPAM)
 *  - Visible unsubscribe link (CAN-SPAM + GDPR)
 *  - Truthful subject line (no clickbait, no fake urgency)
 *  - "Cold email — ignore if not relevant" disclaimer
 */

const ACCOUNT_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MIN_GAP_MS = 800;
let lastCallAt = 0;

const { isCfQuotaError, callAnthropicWithSchema } = require('../../discover-makers/lib/llm-fallback');

const ERGSN_FROM_EMAIL = 'donald@ergsn.net';
const ERGSN_FROM_NAME  = 'Donald Lee · ERGSN Trade Desk';
const ERGSN_PHYSICAL_ADDRESS = 'ERGSN Trade Desk · Yangpyeong, Gyeonggi-do, Republic of Korea';
const UNSUB_BASE = 'https://ergsn.net/unsubscribe';

const SECTOR_PITCH = {
  'k-security': {
    flagship: 'DL Series industrial paper shredders',
    proof: 'GSA Schedule 36 listed, 13-year supply partnership with Capital Shredder Corp. (Rockville, MD) — zero failed inspections, all-metal chain drive, oil-free operation, P-4/P-5 security levels.',
    angle: 'Replacing aging Fellowes / HSM lines, expanding GSA-compliant sourcing, or adding a high-security spec to your catalog.'
  },
  'k-tech': {
    flagship: 'Korean stereoscopic 3D conversion + display systems',
    proof: 'Tier-1 K-fab partners, ISO-9001 / CE certified.',
    angle: 'Display technology, AV systems integration, signage projects.'
  },
  'k-energy': {
    flagship: 'HYGEN industrial generators (4 configurations)',
    proof: 'Korean tier-1 manufacturer, CE marked, multi-fuel.',
    angle: 'Backup power, grid-edge, mobile generation.'
  },
  'k-bio': {
    flagship: 'Korean medical-device + cosmeceutical manufacturers (Cosmedique 16 SKUs, Iho Biotech RAY-1, Rosetta Plus HFF)',
    proof: 'KFDA / FDA registered, K-beauty bridge formulations.',
    angle: 'Private label, distribution licensing.'
  },
  'k-beauty': {
    flagship: 'Korean cosmetics OEM/ODM (Cosmedique 16 SKUs)',
    proof: 'K-beauty manufacturers with full export documentation, MOQ from 1,000.',
    angle: 'Private label, brand licensing, bulk distribution.'
  },
  'k-culture-goods': {
    flagship: 'Korean traditional crafts (modern hanbok, premium ceramics, hanji stationery)',
    proof: 'Master-craftsman lineage, K-wave aesthetic.',
    angle: 'Specialty retail, gift import, museum / hospitality fit-out.'
  },
  'k-franchise': {
    flagship: 'Korean F&B + lifestyle franchise concepts',
    proof: 'Seoul-based, master-franchise / territory-exclusive deals.',
    angle: 'Master-franchise development, territory licensing.'
  },
  'k-smart-living': {
    flagship: 'Korean smart-home appliances (Hejhome / Goqual partner brands)',
    proof: 'KC / CE certified, IoT app integrations, MOQ from 1,000.',
    angle: 'Smart-home distribution, retail private label.'
  },
  'k-tourism-assets': {
    flagship: 'Yangpyeong Soohyang The Hanok (4 unit types · 11 rooms · gujwa-bunyang share program)',
    proof: 'Verified hanok stay assets, fractional share-ownership available.',
    angle: 'Korea inbound travel, fractional ownership, hospitality investment.'
  }
};

const SYSTEM = [
  'You are a B2B trade desk copywriter for ERGSN, a Korean export sourcing platform.',
  'You will receive a buyer profile and a sector pitch block. Compose ONE proposal-style cold email to the buyer\'s decision-maker, in clear professional English, with a TRUTHFUL subject line.',
  '',
  'Hard rules:',
  '- Output JSON only: { "subject": string, "htmlBody": string, "textBody": string, "openingHook": string }.',
  '- "subject" ≤ 70 chars, no ALL-CAPS, no exclamation marks, no fake urgency. Lead with what ERGSN can supply that\'s relevant to the buyer.',
  '- "htmlBody" is the body markup ONLY (no <html>/<head>/<body> wrapper — the mail Worker wraps it). Use <p> + <ul> + <strong> + <a>. Total length 180-300 words.',
  '- "textBody" is a plain-text version of the same content (line-wrapped at ~76 chars).',
  '- "openingHook" is one sentence (≤ 140 chars) that shows you\'ve actually looked at the buyer\'s site — referencing their primaryProductInterest, country, or buyerType. NO generic "I came across your company" lines.',
  '',
  'Structure of the body (in order):',
  '1. Opening hook (the openingHook sentence)',
  '2. One sentence on what ERGSN does ("verified Korean manufacturer sourcing platform — 13yr GSA-listed track record on flagship DL Series shredders")',
  '3. Sector pitch — paste the flagship product + proof line + angle from the SECTOR PITCH block, paraphrased to fit naturally',
  '4. Two-line "what we\'d like to explore" CTA — short, low-pressure ("would a 20-min call next week make sense?")',
  '5. Sign-off — Donald Lee, ERGSN Trade Desk, https://ergsn.net/',
  '',
  'Tone:',
  '- Professional, peer-to-peer. Not salesy. Not buzzword-stuffed.',
  '- Acknowledge that this is a cold email ("apologies if this lands cold").',
  '- Never overclaim — if the buyer\'s primaryProductInterest does not align with the sector pitch, say so honestly and ask if the sector still resonates.',
  '',
  'Compliance (CAN-SPAM + GDPR):',
  '- Do NOT include the unsubscribe link or physical address in your output — the caller appends a standardized footer.',
  '- Do NOT use deceptive headers, fake reply-to, image-only emails, or hidden text.'
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    htmlBody: { type: 'string' },
    textBody: { type: 'string' },
    openingHook: { type: 'string' }
  },
  required: ['subject', 'htmlBody', 'textBody', 'openingHook']
};

function complianceFooterHtml(buyer) {
  const unsubUrl = `${UNSUB_BASE}?id=${encodeURIComponent(buyer.id)}&sig=${encodeURIComponent(simpleSig(buyer.id))}`;
  return [
    '<hr style="border:0;border-top:1px solid #d8d4cb;margin:24px 0 12px">',
    '<p style="font-size:11px;line-height:1.5;color:#6c6356;margin:0 0 6px">',
    'You are receiving this because ERGSN identified your organization as a possible procurement match for verified Korean manufacturers. ',
    'If this is not relevant, <a href="' + unsubUrl + '" style="color:#6c6356;text-decoration:underline">unsubscribe in one click</a> and we won\'t email you again.',
    '</p>',
    '<p style="font-size:11px;line-height:1.5;color:#6c6356;margin:0">' + ERGSN_PHYSICAL_ADDRESS + '</p>'
  ].join('');
}

function complianceFooterText(buyer) {
  const unsubUrl = `${UNSUB_BASE}?id=${encodeURIComponent(buyer.id)}&sig=${encodeURIComponent(simpleSig(buyer.id))}`;
  return [
    '',
    '---',
    'You are receiving this because ERGSN identified your organization as a possible procurement match for verified Korean manufacturers.',
    'If this is not relevant, unsubscribe in one click: ' + unsubUrl,
    ERGSN_PHYSICAL_ADDRESS
  ].join('\n');
}

function simpleSig(id) {
  // Cheap deterministic suffix so an unsubscribe URL can't be guessed for a
  // different buyer id. Real signing should use HMAC + a server-side secret;
  // good enough for v0 (the receiving Worker will validate).
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function buildUserMsg(buyer) {
  const sector = buyer.sector || 'multi';
  const pitch = SECTOR_PITCH[sector] || SECTOR_PITCH['k-security']; // safe fallback
  const profile = {
    legalName: buyer.legalName,
    displayName: buyer.displayName,
    country: buyer.country,
    region: buyer.region,
    sector: buyer.sector,
    buyerType: buyer.buyerType,
    primaryProductInterest: buyer.primaryProductInterest || [],
    knownTradeHistoryWithKorea: !!buyer.knownTradeHistoryWithKorea,
    decisionMaker: (buyer.contact && buyer.contact.decisionMaker) || '',
    decisionMakerTitle: (buyer.contact && buyer.contact.decisionMakerTitle) || ''
  };
  return [
    '<BUYER_PROFILE>', JSON.stringify(profile, null, 2), '</BUYER_PROFILE>',
    '',
    '<SECTOR_PITCH>', JSON.stringify(pitch, null, 2), '</SECTOR_PITCH>',
    '',
    'Compose the JSON object now.'
  ].join('\n');
}

function safeParseJson(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function composeMail(buyer, { model = DEFAULT_MODEL, maxTokens = 1200 } = {}) {
  if (!buyer || !buyer.id) throw new Error('composeMail: buyer.id required');
  if (buyer.status === 'unsubscribed' || buyer.status === 'rejected') {
    throw new Error(`Refusing to compose for buyer "${buyer.id}" with status "${buyer.status}"`);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken  = process.env.CLOUDFLARE_AI_TOKEN;
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID missing in .env');
  if (!apiToken)  throw new Error('CLOUDFLARE_AI_TOKEN missing in .env');

  const userMsg = buildUserMsg(buyer);
  const cfUrl = `${ACCOUNT_BASE}/${encodeURIComponent(accountId)}/ai/run/${model}`;
  const body = {
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    max_tokens: maxTokens,
    temperature: 0.4,
    response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA }
  };

  async function callOnce() {
    const gap = lastCallAt + MIN_GAP_MS - Date.now();
    if (gap > 0) await new Promise(r => setTimeout(r, gap));
    lastCallAt = Date.now();
    return fetch(cfUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'User-Agent': 'ERGSN-buyer-research/1.0 (+https://ergsn.net)' },
      body: JSON.stringify(body)
    });
  }

  let res = await callOnce();
  if (res.status === 429 || res.status === 503) { await new Promise(r => setTimeout(r, 4000)); res = await callOnce(); }

  let parsed = null, usage = null, source = 'cf-workers-ai';
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const errMsg = `Workers AI ${res.status}: ${errBody.slice(0, 220)}`;
    if (isCfQuotaError(errMsg)) {
      const fb = await callAnthropicWithSchema({ system: SYSTEM, user: userMsg, schema: RESPONSE_SCHEMA, maxTokens });
      parsed = fb.parsed; usage = fb.usage; source = fb.source;
    } else {
      throw new Error(errMsg);
    }
  } else {
    const data = await res.json();
    if (data.success === false) {
      const errMsg = `Workers AI error: ${JSON.stringify(data.errors || data).slice(0, 220)}`;
      if (isCfQuotaError(errMsg)) {
        const fb = await callAnthropicWithSchema({ system: SYSTEM, user: userMsg, schema: RESPONSE_SCHEMA, maxTokens });
        parsed = fb.parsed; usage = fb.usage; source = fb.source;
      } else {
        throw new Error(errMsg);
      }
    } else {
      const r = data.result || {};
      let text;
      if (typeof r.response === 'string') text = r.response;
      else if (r.response && typeof r.response === 'object') text = JSON.stringify(r.response);
      else text = '';
      parsed = safeParseJson(text);
      if (r.usage) usage = { input_tokens: r.usage.prompt_tokens || 0, output_tokens: r.usage.completion_tokens || 0 };
    }
  }

  if (!parsed || !parsed.subject || !parsed.htmlBody) {
    throw new Error('composeMail: model returned malformed JSON');
  }

  // Append compliance footer (we control this, not the LLM)
  const htmlBody = String(parsed.htmlBody) + complianceFooterHtml(buyer);
  const textBody = String(parsed.textBody || '').trim() + complianceFooterText(buyer);

  const draft = {
    buyerId: buyer.id,
    buyerLegalName: buyer.legalName,
    toEmail: (buyer.contact && (buyer.contact.procurementEmail || buyer.contact.primaryEmail)) || '',
    toName:  (buyer.contact && buyer.contact.decisionMaker) || buyer.displayName || buyer.legalName,
    fromEmail: ERGSN_FROM_EMAIL,
    fromName: ERGSN_FROM_NAME,
    replyTo: ERGSN_FROM_EMAIL,
    subject: String(parsed.subject).slice(0, 200),
    htmlBody,
    textBody,
    openingHook: String(parsed.openingHook || '').slice(0, 200),
    sector: buyer.sector,
    composedAt: new Date().toISOString(),
    composedBy: source,
    usage,
    status: 'draft'  // draft → approved → sent → bounced → replied
  };
  return draft;
}

module.exports = { composeMail, ERGSN_FROM_EMAIL, ERGSN_PHYSICAL_ADDRESS, complianceFooterHtml, complianceFooterText };
