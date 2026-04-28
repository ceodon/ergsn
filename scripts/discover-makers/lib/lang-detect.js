'use strict';

const { politeFetch } = require('./fetch');
const { extractHtmlLang } = require('./extract-hints');
const { sameHost, bareHost } = require('./normalize');

/**
 * Decide whether a maker has an English homepage and return the best URL +
 * the heuristic that found it. Strategies are tried in order — first hit wins.
 *
 * Inputs: the rootUrl that's already been fetched, plus the parsed hints from
 * extractAll(). Sub-fetches are kept to a max of 4 — anything more than that
 * means the site doesn't really have an English presence.
 *
 * Strategies (in order):
 *   1. Root page itself is already English (html lang starts with 'en')
 *   2. hreflang link with lang starting 'en'
 *   3. /en/ or /english/ subpath returns 200 + html lang en
 *   4. en.<host> subdomain returns 200 + html lang en
 *   5. Language toggle anchor in markup (text EN/English) on the same host
 *   6. (skip) Content heuristic — defer to LLM enrichment phase
 */

const SUBPATHS = ['/en/', '/eng/', '/english/', '/en-us/', '/en/index.html', '/en/main.html'];

function isEn(lang) {
  return lang && lang.toLowerCase().startsWith('en');
}

function absUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).href; } catch { return ''; }
}

async function probe(url) {
  const r = await politeFetch(url);
  if (!r.ok) return null;
  const lang = extractHtmlLang(r.text);
  return { url: r.finalUrl || url, lang, text: r.text };
}

async function detectEnglishHomepage({ rootUrl, hints }) {
  // 1. Root is already English
  if (isEn(hints.htmlLang)) {
    return { englishUrl: rootUrl, detectedBy: 'html-lang' };
  }

  // 2. hreflang link
  const enHrefLang = (hints.hreflang || []).find(x => isEn(x.lang));
  if (enHrefLang) {
    const url = absUrl(enHrefLang.href, rootUrl);
    if (url) return { englishUrl: url, detectedBy: 'hreflang' };
  }

  // 3. /en/ subpaths
  for (const sp of SUBPATHS) {
    const url = absUrl(sp, rootUrl);
    if (!url) continue;
    const r = await probe(url);
    if (r && isEn(r.lang)) {
      return { englishUrl: r.url, detectedBy: 'en-subpath' };
    }
  }

  // 4. en.<host> subdomain
  const host = bareHost(rootUrl);
  if (host && !host.startsWith('en.')) {
    const enSub = `https://en.${host}/`;
    const r = await probe(enSub);
    if (r && isEn(r.lang)) {
      return { englishUrl: r.url, detectedBy: 'en-subdomain' };
    }
  }

  // 5. Language-toggle anchor on the same host
  for (const candidate of (hints.englishToggleLinks || [])) {
    const url = absUrl(candidate, rootUrl);
    if (!url) continue;
    if (!sameHost(url, rootUrl) && !url.startsWith(`https://en.${host}`)) continue;
    const r = await probe(url);
    if (r && isEn(r.lang)) {
      return { englishUrl: r.url, detectedBy: 'lang-toggle-link' };
    }
  }

  return null;
}

module.exports = { detectEnglishHomepage };
