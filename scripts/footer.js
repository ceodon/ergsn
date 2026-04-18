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
    '#ergsnFooter .ef-top{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;gap:clamp(1.5rem,3vw,2.5rem);padding-bottom:2rem;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:1.5rem}',
    '@media (max-width:960px){#ergsnFooter .ef-top{grid-template-columns:1fr 1fr 1fr}#ergsnFooter .ef-brand{grid-column:1 / -1}}',
    '@media (max-width:680px){#ergsnFooter .ef-top{grid-template-columns:1fr 1fr}#ergsnFooter .ef-brand{grid-column:1 / -1}}',
    '#ergsnFooter .ef-logo-row{display:flex;align-items:center;margin-bottom:1rem}',
    '#ergsnFooter .ef-logo{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;position:relative;padding-bottom:5px;background:linear-gradient(320deg,#a8a8a6 15%,#c2c0c0 48%,#f9f8f6 64%,#d4d4d4 76%,#7f7f7f 88%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:#fff}',
    '#ergsnFooter .ef-logo .ef-e{background:linear-gradient(84deg,#00bf79 42%,#00ffa1 81%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
    '#ergsnFooter .ef-about{font-size:12px;color:#6b7685;line-height:1.75;margin:0}',
    '#ergsnFooter .ef-col-title{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#34d298;margin:0 0 1rem}',
    '#ergsnFooter .ef-links{list-style:none;margin:0;padding:0;line-height:normal}',
    '#ergsnFooter .ef-links li{margin:0 0 7px;line-height:normal}',
    '#ergsnFooter .ef-links a{font-size:13px;color:#6b7685;transition:color .15s;text-decoration:none;line-height:normal;display:inline-block}',
    '#ergsnFooter .ef-links a:hover{color:#fff}',
    '#ergsnFooter .ef-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}',
    '#ergsnFooter .ef-copy{font-size:11px;color:#8a8b8d;margin:0}',
    '#ergsnFooter .ef-copy a{color:#8a8b8d;text-decoration:none}',
    '#ergsnFooter .ef-copy a:hover{color:#cfcfcf}',
    '#ergsnFooter .ef-kr-chip{display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid #34d298;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#34d298;vertical-align:1px}',
    '@media print{#ergsnFooter{display:none !important}}'
  ].join('');

  var MARKUP = (
    '<footer id="ergsnFooter" role="contentinfo">' +
      '<div class="ef-inner">' +
        '<div class="ef-top">' +
          '<div class="ef-brand">' +
            '<div class="ef-logo-row">' +
              '<span class="ef-logo"><span class="ef-e">E</span>RGSN</span>' +
            '</div>' +
            '<p class="ef-about">Korea\u2019s Trusted Trade Gateway.<br>#503 Susong BD, 12-21, Seoae-ro 5-gil,<br>Joong-gu, Seoul 04623, Republic of Korea</p>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Shop</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html#products">K-Security</a></li>' +
              '<li><a href="index.html#products">K-Tech</a></li>' +
              '<li><a href="index.html#products">K-Energy</a></li>' +
              '<li><a href="index.html#products">K-Bio</a></li>' +
              '<li><a href="index.html#products">K-Beauty</a></li>' +
              '<li><a href="index.html#products">K-Culture Goods</a></li>' +
              '<li><a href="index.html#products">K-Franchise</a></li>' +
              '<li><a href="index.html#products">K-Smart Living</a></li>' +
              '<li><a href="index.html#match">AI Partner Match</a></li>' +
              '<li><a href="index.html#calculator">Quote Calculator</a></li>' +
              '<li><a href="export-docs.html">Export Documents AI</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">For Buyers</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html#wanted">Wanted Board</a></li>' +
              '<li><a href="index.html#trend">Trend Monthly</a></li>' +
              '<li><a href="buyers-healthcare.html">Healthcare Procurement</a></li>' +
              '<li><a href="buyers-government.html">Government Procurement</a></li>' +
              '<li><a href="buyers-hospitality.html">Hospitality &amp; Retail</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Trust</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html#about">About ERGSN</a></li>' +
              '<li><a href="index.html#cases">Case Studies</a></li>' +
              '<li><a href="index.html#verify">Verification Process</a></li>' +
              '<li><a href="verified-partner.html">Verified Partner Program</a></li>' +
              '<li><a href="escrow.html">Escrow Service</a></li>' +
              '<li><a href="index.html#map">Trade Route Map</a></li>' +
              '<li><a href="index.html#compliance">Compliance</a></li>' +
              '<li><a href="index.html#qa">Q&amp;A Wall</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<p class="ef-col-title">Connect</p>' +
            '<ul class="ef-links">' +
              '<li><a href="index.html#rfq">Request a Quote</a></li>' +
              '<li><a href="index.html#tools">Book a Demo</a></li>' +
              '<li><a href="trade-mission.html">Trade Mission Live</a></li>' +
              '<li><a href="tracker.html">RFQ Tracker</a></li>' +
              '<li><a href="https://t.me/ceodon" target="_blank" rel="noopener noreferrer">Telegram</a></li>' +
              '<li><a href="https://wa.me/821052880006" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>' +
              '<li><a href="partners-kr.html" style="color:#34d298"><span class="ef-kr-chip">KR</span>\uD30C\uD2B8\uB108 \uBB38\uC758</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="ef-bottom">' +
          '<p class="ef-copy">\u00A9 2013 ERGSN CO., LTD. All rights reserved \u00B7 Made in Korea \u00B7 <a href="privacy.html">Privacy</a> \u00B7 <a href="terms.html">Terms</a></p>' +
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
