/* ERGSN shared footer — mirrors index.html's <footer id="footer"> exactly.
   Self-injects into every standalone page so the five-column link grid,
   address, and copyright row stay consistent across the whole site.

   Bails out if a `#footer` already exists (i.e. we're on index.html), so
   the homepage keeps its inline footer untouched. Scoped to avoid
   colliding with host-page CSS, @media print hides in PDF exports,
   anchors resolve against index.html so links work from anywhere. */
(function () {
  if (window.__ergsnFooterInjected) return;
  window.__ergsnFooterInjected = true;
  if (document.getElementById('footer')) return;

  var CSS = [
    /* `line-height: normal` on the footer root so host pages that set
       `body { line-height: 1.65 }` (export-docs, tracker, trend-2026-04
       etc.) don't inflate each link row the way index.html never does.
       Individual blocks that need tighter/looser line-height (ef-about)
       override explicitly. */
    '#ergsnFooter{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#cfcfcf;line-height:normal}',
    '#ergsnFooter *{box-sizing:border-box}',
    '#ergsnFooter .ef-inner{max-width:1240px;margin:0 auto;padding:clamp(2.5rem,5vh,4rem) clamp(16px,4vw,48px) clamp(1.5rem,3vh,2.5rem)}',
    /* Responsive grid — mirrors index.html's footer exactly.
       Desktop: 5 cols (1.6fr + 4×1fr). At ≤960px drop to 3 cols with
       brand spanning the full row; at ≤680px drop to 2 cols, brand
       still spans. No 420px single-column rule — index.html keeps
       2 cols all the way down so content reads balanced on mobile
       instead of a left-aligned stack. */
    '#ergsnFooter .ef-top{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1fr 1fr;gap:clamp(1.25rem,2.4vw,2rem);padding-bottom:2rem;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:1.5rem}',
    '@media (max-width:960px){#ergsnFooter .ef-top{grid-template-columns:1fr 1fr 1fr}#ergsnFooter .ef-brand{grid-column:1 / -1}}',
    '@media (max-width:680px){#ergsnFooter .ef-top{grid-template-columns:1fr 1fr}#ergsnFooter .ef-brand{grid-column:1 / -1}}',
    '#ergsnFooter .ef-logo-row{display:flex;align-items:center;margin-bottom:1rem}',
    '#ergsnFooter .ef-logo{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;position:relative;padding-bottom:5px;background:linear-gradient(320deg,#a8a8a6 15%,#c2c0c0 48%,#f9f8f6 64%,#d4d4d4 76%,#7f7f7f 88%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:#fff;font-kerning:none;font-feature-settings:"kern" 0;-webkit-font-feature-settings:"kern" 0}',
    '#ergsnFooter .ef-logo .ef-e{background:linear-gradient(84deg,#00bf79 42%,#00ffa1 81%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
    '#ergsnFooter .ef-about{font-size:12px;color:#6b7685;line-height:1.75;margin:0}',
    '#ergsnFooter .ef-col-title{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#34d298;margin:0 0 1rem}',
    '#ergsnFooter .ef-links{list-style:none;margin:0;padding:0;line-height:normal}',
    '#ergsnFooter .ef-links li{margin:0 0 7px;line-height:normal}',
    '#ergsnFooter .ef-links a{font-size:13px;color:#6b7685;transition:color .15s;text-decoration:none;line-height:normal;display:inline-block}',
    '#ergsnFooter .ef-links a:hover{color:#fff}',
    '#ergsnFooter .ef-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}',
    '#ergsnFooter .ef-copy{font-size:11px;color:#8a8b8d;margin:0;line-height:1.9}',
    '#ergsnFooter .ef-copy a{color:#8a8b8d;text-decoration:none}',
    '#ergsnFooter .ef-copy a:hover{color:#cfcfcf}',
    /* Keep copyright phrase atomic; allow line breaks only between pairs */
    '#ergsnFooter .ef-copy .ef-copy-main{white-space:nowrap}',
    '#ergsnFooter .ef-copy .ef-link{white-space:nowrap}',
    '#ergsnFooter .ef-copy .ef-mid{margin:0 6px 0 2px;color:#3a3d40}',
    '#ergsnFooter .ef-kr-chip{display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid #34d298;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#34d298;vertical-align:1px}',
    '@media print{#ergsnFooter{display:none !important}}'
  ].join('');

  /* Korean-language pages add a KakaoTalk link to the utility row.
     Detection is `<html lang="ko">` only — overseas English buyers
     don't use Kakao. Reference: memory/feedback_contact_chips_kr_pages.md */
  var IS_KR = (function () {
    try { return (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('ko') === 0; }
    catch (_) { return false; }
  })();
  var KAKAO_LINK = ' <span class="ef-link"><span class="ef-mid">·</span><a href="https://pf.kakao.com/_AxowjX" target="_blank" rel="noopener noreferrer">KakaoTalk</a></span>';

  var MARKUP = (
    '<footer id="ergsnFooter" role="contentinfo">' +
      '<div class="ef-inner">' +
        '<div class="ef-top">' +
          '<div class="ef-brand">' +
            '<div class="ef-logo-row">' +
              '<span class="ef-logo"><span class="ef-e">E</span><span>R</span><span>G</span><span>S</span><span>N</span></span>' +
            '</div>' +
            '<p class="ef-about">Korea’s Trusted Trade Gateway.<br>#503 Susong BD, 12-21, Seoae-ro 5-gil,<br>Joong-gu, Seoul 04623, Republic of Korea</p>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Shop</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html?sector=k-security#products">K-Security</a></li>' +
              '<li><a href="index.html?sector=k-tech#products">K-Tech</a></li>' +
              '<li><a href="index.html?sector=k-energy#products">K-Energy</a></li>' +
              '<li><a href="index.html?sector=k-bio#products">K-Bio</a></li>' +
              '<li><a href="index.html?sector=k-beauty#products">K-Beauty</a></li>' +
              '<li><a href="index.html?sector=k-tourism-assets#products">K-Tourism Assets</a></li>' +
              '<li><a href="index.html?sector=k-culture-goods#products">K-Culture Goods</a></li>' +
              '<li><a href="index.html?sector=k-franchise#products">K-Franchise</a></li>' +
              '<li><a href="index.html?sector=k-smart-living#products">K-Smart Living</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Solutions</p>' +
            '<ul class="ef-links">' +
              '<li><a href="buyers-healthcare.html">Healthcare Procurement</a></li>' +
              '<li><a href="buyers-government.html">Government Procurement</a></li>' +
              '<li><a href="buyers-hospitality.html">Hospitality &amp; Retail</a></li>' +
              '<li><a href="kbeauty-latam.html">K-Beauty · LATAM pitch</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Tools</p>' +
            '<ul class="ef-links">' +
              '<li><a href="tools.html" style="color:#34d298;font-weight:700">Tools Hub (8 Free)</a></li>' +
              '<li><a href="quote-calculator.html">Quote Calculator</a></li>' +
              '<li><a href="ai-partner-match.html">AI Partner Match</a></li>' +
              '<li><a href="trade-route-map.html">Trade Route Map</a></li>' +
              '<li><a href="wanted-board.html">Buyer Wanted Board</a></li>' +
              '<li><a href="tools-landed-cost.html">Landed Cost Calculator</a></li>' +
              '<li><a href="export-docs.html">Export Documents AI</a></li>' +
              '<li><a href="tracker.html">RFQ Tracker</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Trust</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html#about">About ERGSN</a></li>' +
              '<li><a href="index.html#cases">Case Studies</a></li>' +
              '<li><a href="index.html#verify">Verification Process</a></li>' +
              '<li><a href="verified-partner.html">Verified Partner Program</a></li>' +
              '<li><a href="verified-certificate.html">Verified Certificate</a></li>' +
              '<li><a href="escrow.html">Escrow Service</a></li>' +
              '<li><a href="index.html#compliance">Compliance</a></li>' +
              '<li><a href="index.html#trend">Trend Monthly</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Connect</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html#rfq">Request a Quote</a></li>' +
              '<li><a href="index.html#tools">Book a Demo</a></li>' +
              '<li><a href="trade-mission.html">Trade Mission Live</a></li>' +
              '<li><a href="index.html#qa">Q&amp;A Wall</a></li>' +
              '<li><a href="https://t.me/ceodon" target="_blank" rel="noopener noreferrer">Telegram</a></li>' +
              '<li><a href="https://wa.me/821052880006" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>' +
              '<li><a href="partners-kr.html" style="color:#34d298"><span class="ef-kr-chip">KR</span>제조사 파트너</a></li>' +
              '<li><a href="partners-tourism.html" style="color:#34d298"><span class="ef-kr-chip">KR</span>K-Tourism 파트너</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="ef-bottom">' +
          '<p class="ef-copy">' +
            '<span class="ef-copy-main">Copyright &copy; 2013 ERGSN All rights reserved</span> ' +
            '<span class="ef-link"><span class="ef-mid">·</span><a href="privacy.html">Privacy</a></span> ' +
            '<span class="ef-link"><span class="ef-mid">·</span><a href="terms.html">Terms</a></span> ' +
            '<span class="ef-link"><span class="ef-mid">·</span><a href="index.html#compliance">Compliance</a></span> ' +
            '<span class="ef-link"><span class="ef-mid">·</span><a href="sitemap.html">Sitemap</a></span> ' +
            '<span class="ef-link"><span class="ef-mid">·</span><a href="https://t.me/ceodon" target="_blank" rel="noopener noreferrer">Telegram</a></span> ' +
            '<span class="ef-link"><span class="ef-mid">·</span><a href="https://wa.me/821052880006" target="_blank" rel="noopener noreferrer">WhatsApp</a></span>' +
            (IS_KR ? KAKAO_LINK : '') +
          '</p>' +
        '</div>' +
      '</div>' +
    '</footer>'
  );

  function inject() {
    if (!document.body) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = MARKUP;
    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
