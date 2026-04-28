'use strict';

/**
 * Pull structured hints out of HTML without a full DOM parser.
 *
 * Targets:
 *   - <html lang="...">
 *   - <link rel="alternate" hreflang="..." href="...">
 *   - <meta property="og:..." content="...">  (og:site_name, og:title, og:locale, og:url)
 *   - <meta name="description" content="...">
 *   - <script type="application/ld+json"> ... </script>  (LocalBusiness/Organization preferred)
 *   - <a href="..."> text matches EN/English language toggle
 *
 * Regex-only, deliberately. cheerio would pull a 600KB dep just for this.
 * The hints are best-effort — verify.js cross-checks them with sub-fetches.
 */

function extractHtmlLang(html) {
  const m = html.match(/<html[^>]*\blang\s*=\s*["']?([^"'\s>]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function extractHreflang(html) {
  const out = [];
  const re = /<link[^>]+rel\s*=\s*["']?alternate[^>]+hreflang\s*=\s*["']?([^"'\s>]+)["']?[^>]*href\s*=\s*["']([^"']+)/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({ lang: m[1].toLowerCase(), href: m[2] });
  }
  // also support reversed attribute order
  const re2 = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+hreflang\s*=\s*["']?([^"'\s>]+)/gi;
  while ((m = re2.exec(html))) {
    if (!out.find(x => x.href === m[1] && x.lang === m[2].toLowerCase())) {
      out.push({ lang: m[2].toLowerCase(), href: m[1] });
    }
  }
  return out;
}

function extractMetaContent(html, key, isProperty) {
  const attr = isProperty ? 'property' : 'name';
  const re = new RegExp(`<meta[^>]+${attr}\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*${attr}\\s*=\\s*["']${key}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : '';
}

function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) out.push(...obj);
      else if (obj && obj['@graph']) out.push(...obj['@graph']);
      else out.push(obj);
    } catch {
      // ignore — many sites ship slightly invalid JSON-LD
    }
  }
  return out;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/**
 * Collect anchor links whose visible text suggests an English language toggle.
 * Returns up to 5 candidate hrefs (raw, may be relative).
 */
function extractEnglishToggleLinks(html) {
  const out = [];
  const re = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 5) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim().toUpperCase();
    if (!text) continue;
    if (/^(EN|ENG|ENGLISH|GLOBAL|GO TO ENGLISH SITE)$/.test(text) ||
        /\bENGLISH\b/.test(text) && text.length < 25) {
      out.push(href);
    }
  }
  return out;
}

/**
 * Pluck the first JSON-LD node that looks like a company / organisation /
 * local business and project a flat summary for the maker-directory entry.
 */
function summariseJsonLd(jsonLdItems) {
  const companyTypes = new Set(['Organization', 'Corporation', 'LocalBusiness', 'Manufacturer', 'Brand', 'OnlineStore']);
  const isCompany = (t) => {
    if (!t) return false;
    if (Array.isArray(t)) return t.some(x => companyTypes.has(x));
    return companyTypes.has(t);
  };
  const node = jsonLdItems.find(o => o && isCompany(o['@type']));
  if (!node) return null;
  const addr = node.address || {};
  return {
    legalName: node.legalName || node.name || '',
    telephone: node.telephone || '',
    email: (typeof node.email === 'string') ? node.email.replace(/^mailto:/i, '') : '',
    url: node.url || '',
    address: typeof addr === 'string' ? addr :
      [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
        .filter(Boolean).join(', '),
    addressCountry: typeof addr === 'object' ? (addr.addressCountry || '') : '',
    types: Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
  };
}

function extractAll(html, baseUrl) {
  const jsonLd = extractJsonLd(html);
  const company = summariseJsonLd(jsonLd);
  return {
    htmlLang: extractHtmlLang(html),
    hreflang: extractHreflang(html),
    title: extractTitle(html),
    metaDescription: extractMetaContent(html, 'description', false),
    ogSiteName: extractMetaContent(html, 'og:site_name', true),
    ogTitle: extractMetaContent(html, 'og:title', true),
    ogLocale: extractMetaContent(html, 'og:locale', true),
    ogUrl: extractMetaContent(html, 'og:url', true),
    englishToggleLinks: extractEnglishToggleLinks(html),
    jsonLdTypes: Array.from(new Set(jsonLd.flatMap(o => Array.isArray(o?.['@type']) ? o['@type'] : [o?.['@type']]).filter(Boolean))),
    company // null when no Organization/LocalBusiness JSON-LD
  };
}

module.exports = { extractAll, extractHtmlLang, extractHreflang, extractJsonLd, summariseJsonLd };
