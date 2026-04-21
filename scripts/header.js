/* ERGSN shared header — full parity with index.html's nav, injected into
   every standalone page.

   Desktop (>680px): horizontal nav with four hover dropdowns (Shop / For
   Buyers / Trust / Connect), Request Quote CTA, and language selector.
   Mobile (<=680px): logo + hamburger; tapping opens a slide-down panel
   that mirrors index.html's <details>-style mobile menu exactly.

   Design notes:
   - Self-injecting. Add `<script defer src="scripts/header.js"></script>`
     to any page and the bar + menu appear automatically.
   - Bails out if the page already owns a `#nav` (i.e. we're on index.html).
   - Uses an `eh-` class prefix so nothing collides with host-page CSS.
     All tokens (colors, spacing, breakpoint) come from index.html's :root
     so the look is pixel-parity with the homepage.
   - All anchor links resolve against index.html so they work from any
     location; standalone page targets use their own filenames.
   - Language selection writes `ergsn_lang` to localStorage and navigates
     to index.html where the existing initLang bootstrap applies it
     (standalone pages don't carry the T map).
   - `@media print` hides the bar so PDF exports stay clean.
   - No user input is interpolated into markup — every string is a static
     literal, so innerHTML-based construction is safe. */
(function () {
  if (window.__ergsnHeaderInjected) return;
  window.__ergsnHeaderInjected = true;
  if (document.getElementById('nav')) return;

  /* Pull in the other shared modules on standalone pages so a page only
     has to load scripts/header.js to get the full chrome set (header +
     footer + chatbot + Top FAB). Each companion script self-injects and
     bails out if the page already owns its target DOM, so loading them
     on index.html would be a no-op — but we still gate with the #nav
     check above. */
  function loadCompanion(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = src;
    document.head.appendChild(s);
  }
  loadCompanion('scripts/footer.js');
  loadCompanion('scripts/chat.js');

  /* Menu structure mirrors index.html's dropdowns one-for-one. The `a` field
     is the top-level dropdown heading (href is the landing anchor on
     index.html); items are the rows inside each dropdown. Items with a
     `divider:true` flag render as a hairline separator on desktop and are
     skipped on mobile. */
  var MENU = [
    {
      title: 'Shop',
      href: 'index.html#products',
      items: [
        { href: 'index.html#products', name: 'K-Security',      tag: 'Active', desc: 'DL Series shredders · in stock' },
        { href: 'index.html#products', name: 'K-Tech',          tag: 'Active', desc: '2D → 3D stereoscopic conversion' },
        { href: 'index.html#products', name: 'K-Energy',        tag: 'Active', desc: 'HYGEN Generator · one-shaft multi-gen' },
        { href: 'index.html#products', name: 'K-Bio',           tag: 'Active', desc: 'Rosetta Plus · HACCP · KFDA' },
        { href: 'index.html#products', name: 'K-Beauty',        tag: 'Sourcing', tagSoon: true, desc: 'Skincare · cosmetics · devices' },
        { href: 'index.html#products', name: 'K-Culture Goods', tag: 'Sourcing', tagSoon: true, desc: 'K-pop merch · crafts · fashion' },
        { href: 'index.html#products', name: 'K-Franchise',     tag: 'Sourcing', tagSoon: true, desc: 'F&B · retail · service concepts' },
        { href: 'index.html#products', name: 'K-Smart Living',  tag: 'Sourcing', tagSoon: true, desc: 'Appliances · wellness · lifestyle' },
        { href: 'index.html#match',    name: 'AI Partner Match',    desc: 'Country + industry → Top-3 matches' },
        { href: 'index.html#calculator', name: 'Quote Calculator',  desc: 'Instant CIF/FOB estimate' },
        { href: 'export-docs.html',    name: 'Export Documents AI', desc: 'HS code lookup · duty rates · templates' }
      ]
    },
    {
      title: 'For Buyers',
      href: 'index.html#wanted',
      items: [
        { href: 'index.html#wanted', name: 'Wanted Board',    desc: 'Post a sourcing need · anonymous' },
        { href: 'index.html#trend',  name: 'Trend Monthly',   desc: 'Monthly Korea export intelligence' },
        { divider: true },
        { href: 'buyers-healthcare.html',  name: 'Healthcare Procurement',  desc: 'HIPAA shredders · KFDA HFF · cleanroom' },
        { href: 'buyers-government.html',  name: 'Government Procurement',  desc: 'GSA Schedule · Level-3 · ministerial' },
        { href: 'buyers-hospitality.html', name: 'Hospitality & Retail',    desc: 'K-Beauty · K-Bio wellness · duty-free' }
      ]
    },
    {
      title: 'Trust',
      href: 'index.html#about',
      items: [
        { href: 'index.html#about',     name: 'About ERGSN',           desc: 'Trade platform identity & mission' },
        { href: 'index.html#cases',     name: 'Case Studies',          desc: 'Real shipments · real buyers' },
        { href: 'index.html#verify',    name: 'Verification Process',  desc: '4-step partner qualification' },
        { href: 'verified-partner.html', name: 'Verified Partner Program', desc: 'Official badge & certificate of verification' },
        { href: 'escrow.html',           name: 'Escrow Service',       desc: 'Protected T/T settlement · 1% pilot' },
        { href: 'index.html#map',        name: 'Trade Route Map',      desc: 'Global shipping lanes from Korea' },
        { href: 'index.html#compliance', name: 'Compliance',           desc: 'HIPAA · GSA · DIN 66399' },
        { href: 'index.html#qa',         name: 'Q&A Wall',             desc: 'Buyer community questions & answers' }
      ]
    },
    {
      title: 'Connect',
      href: 'index.html#rfq',
      items: [
        { href: 'index.html#rfq',   name: 'Request a Quote', desc: '2-step form · reply within 1 biz day' },
        { href: 'index.html#tools', name: 'Book a Demo',     desc: '30-min Zoom · compliance checker · landed cost' },
        { href: 'trade-mission.html', name: 'Trade Mission Live', desc: 'Quarterly broadcast · 5 makers × 50 buyers' },
        { href: 'tracker.html',       name: 'RFQ Tracker',        desc: 'Check status of submitted RFQ' },
        { href: 'https://t.me/ceodon',       name: 'Telegram',  desc: 'Chat directly with ERGSN trade team', external: true },
        { href: 'https://wa.me/821052880006', name: 'WhatsApp', desc: 'Chat directly with ERGSN trade team', external: true },
        { href: 'partners-kr.html', name: 'KR · 파트너 문의', kr: true, desc: '한국 제조사 입점 신청' }
      ]
    }
  ];

  var CSS = [
    /* Tokens copied from index.html :root so the bar renders identically
       even on pages that don't share those CSS variables. */
    ':root{--eh-navy-2:#111418;--eh-gold:#34d298;--eh-gold-light:#00ffa1;--eh-white:#fff;--eh-steel:#6b7685;--eh-steel-lt:#a7a7a7;--eh-border:#292929;--eh-nav-h:56px}',
    '#ehNav,#ehNav *,#ehMobileMenu,#ehMobileMenu *{box-sizing:border-box}',
    '#ehNav{position:fixed;top:0;left:0;right:0;z-index:900;height:56px;background:#111418;border-bottom:1px solid #1e252e;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    /* Push host page content below the 56px fixed bar. Using !important here
       because some standalone pages set body { margin: 0 } inline. */
    'body{padding-top:56px !important}',
    /* Prevent stray horizontal overflow on mobile — clamp the document to
       viewport width so accidental wide children (tables, pre, grids with
       hard widths) don't leave a right-side gap when the browser auto-scales. */
    'html,body{overflow-x:hidden !important;max-width:100vw}',
    '#ehNav .eh-inner{max-width:1240px;margin:0 auto;height:100%;padding:0 clamp(16px,4vw,48px);display:flex;align-items:center;justify-content:space-between;gap:clamp(12px,2vw,24px)}',
    /* Logo — byte-for-byte identical to index.html's .logo-mark: system
       font, silver gradient fill, green gradient on the initial "E".
       No fallback color (matches index.html) so browsers rendering
       `-webkit-text-fill-color: transparent` show the gradient through. */
    '#ehNav .eh-logo{display:flex;align-items:center;gap:0;text-decoration:none;flex-shrink:0}',
    '#ehNav .eh-logo-mark{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:clamp(22px,2.8vw,30px);font-weight:800;letter-spacing:.12em;text-transform:uppercase;line-height:1;position:relative;padding-bottom:0;background:linear-gradient(320deg,#a8a8a6 15%,#c2c0c0 48%,#f9f8f6 64%,#d4d4d4 76%,#7f7f7f 88%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
    '#ehNav .eh-logo-mark .eh-e{background:linear-gradient(84deg,#00bf79 42%,#00ffa1 81%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
    /* Right side */
    '#ehNav .eh-right{display:flex;align-items:center;gap:clamp(12px,2vw,20px)}',
    /* Desktop nav links */
    '#ehNav .eh-nav-links{display:flex;align-items:center;gap:clamp(16px,2vw,32px);list-style:none;margin:0;padding:0}',
    '#ehNav .eh-nav-links > li{margin:0;padding:0}',
    '#ehNav .eh-nav-links a{font-size:14px;font-weight:500;letter-spacing:.03em;color:#6b7685;transition:color .15s;text-decoration:none}',
    '#ehNav .eh-nav-links a:hover{color:#fff}',
    '#ehNav .eh-nav-links .eh-nav-cta{background:#34d298;color:#0f1110;padding:7px 18px;border-radius:20px;font-weight:600;transition:background .15s}',
    '#ehNav .eh-nav-links .eh-nav-cta:hover{background:#00ffa1}',
    /* Dropdown */
    '#ehNav .eh-nav-dropdown{position:relative}',
    '#ehNav .eh-nav-dropdown > a{padding:8px 0;display:inline-block}',
    '#ehNav .eh-nav-dropdown > a::after{content:" \\25BE";font-size:9px;opacity:.6}',
    '#ehNav .eh-nav-dropmenu{position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#111418;border:1px solid #292929;border-radius:10px;min-width:240px;padding:8px;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s,visibility .18s,transform .18s;margin-top:0;box-shadow:0 20px 40px rgba(0,0,0,.5);list-style:none;z-index:950}',
    '#ehNav .eh-nav-dropmenu::before{content:"";position:absolute;top:-14px;left:0;right:0;height:14px}',
    '#ehNav .eh-nav-dropdown:hover .eh-nav-dropmenu,#ehNav .eh-nav-dropdown:focus-within .eh-nav-dropmenu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0)}',
    '#ehNav .eh-nav-dropmenu li{display:block;margin:0}',
    '#ehNav .eh-nav-dropmenu a{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:6px;color:#fff;transition:background .15s}',
    '#ehNav .eh-nav-dropmenu a:hover{background:rgba(52,210,152,.1);color:#fff}',
    '#ehNav .eh-nav-dropmenu .eh-ds-name{font-weight:600;font-size:13px;display:flex;align-items:center;gap:8px}',
    '#ehNav .eh-nav-dropmenu .eh-ds-tag{font-size:9px;padding:2px 6px;border-radius:8px;background:rgba(52,210,152,.15);color:#34d298;letter-spacing:.04em;text-transform:uppercase;font-weight:700}',
    '#ehNav .eh-nav-dropmenu .eh-ds-tag.eh-soon{background:rgba(255,255,255,.06);color:#a7a7a7}',
    '#ehNav .eh-nav-dropmenu .eh-ds-desc{font-size:11px;color:#6b7685;font-weight:400}',
    '#ehNav .eh-nav-dropmenu .eh-ds-divider{height:1px;background:rgba(255,255,255,.06);margin:6px 12px;padding:0;list-style:none}',
    '#ehNav .eh-nav-dropmenu .eh-kr-chip{display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid #34d298;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#34d298;vertical-align:1px}',
    /* Language select — mirrors index.html's `.lang-sel` exactly: pill-shaped
       translucent control with `appearance:none` and no custom arrow glyph.
       !important on width/margin/padding/height/background defends against
       pages that use broad `input, select, textarea { width:100% }` rules
       (export-docs.html did this, ballooning the select to full-row width
       and breaking the whole nav layout). */
    /* background-image: linear-gradient(transparent,transparent) is the
       reliable cross-browser trick to suppress the native dropdown
       chevron on mobile Safari/Chrome — `appearance: none` alone leaves
       the chevron visible on some iOS/Android builds. ::-ms-expand
       covers IE/old Edge. */
    '#ehNav .eh-lang{font-family:inherit !important;font-size:12px !important;font-weight:600 !important;letter-spacing:normal !important;color:#fff !important;background-color:rgba(255,255,255,.08) !important;background-image:linear-gradient(transparent,transparent) !important;border:1px solid rgba(255,255,255,.15) !important;border-radius:20px !important;padding:5px 12px !important;margin:0 !important;width:auto !important;height:auto !important;min-height:0 !important;box-sizing:border-box !important;outline:none !important;cursor:pointer !important;-webkit-appearance:none !important;-moz-appearance:none !important;appearance:none !important;transition:border-color .15s !important}',
    '#ehNav .eh-lang:hover,#ehNav .eh-lang:focus{border-color:#34d298 !important}',
    '#ehNav .eh-lang option{background:#171717 !important;color:#fff !important}',
    '#ehNav .eh-lang::-ms-expand{display:none !important}',
    /* Hamburger (desktop hidden, mobile shown) */
    '#ehNav .eh-ham{display:none;flex-direction:column;gap:5px;padding:6px;background:transparent;border:0;cursor:pointer}',
    '#ehNav .eh-ham span{width:22px;height:2px;background:#fff;border-radius:1px;transition:all .2s;display:block}',
    '#ehNav .eh-ham.eh-open span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}',
    '#ehNav .eh-ham.eh-open span:nth-child(2){opacity:0}',
    '#ehNav .eh-ham.eh-open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}',
    '#ehNav .eh-ham:focus-visible,#ehNav .eh-nav-dropdown > a:focus-visible{outline:2px solid #34d298;outline-offset:3px}',
    /* Mobile menu slide-down */
    '#ehMobileMenu{display:none;position:fixed;top:56px;left:0;right:0;max-height:calc(100vh - 56px);overflow-y:auto;background:#111418;z-index:890;border-bottom:1px solid rgba(255,255,255,.08);padding:1.5rem clamp(24px,4vw,48px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    '#ehMobileMenu.eh-open{display:block}',
    '#ehMobileMenu ul{list-style:none;display:flex;flex-direction:column;gap:0;margin:0;padding:0}',
    '#ehMobileMenu a{display:block;font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#a7a7a7;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05);transition:color .18s;text-decoration:none}',
    '#ehMobileMenu a:hover{color:#00ffa1}',
    '#ehMobileMenu .eh-m-cta{color:#34d298}',
    '#ehMobileMenu details{border-bottom:1px solid rgba(255,255,255,.06)}',
    '#ehMobileMenu details > summary{list-style:none;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fff;padding:14px 4px}',
    '#ehMobileMenu details > summary::-webkit-details-marker{display:none}',
    '#ehMobileMenu details > summary::after{content:"+";font-size:20px;font-weight:400;color:#34d298;transition:transform .2s}',
    '#ehMobileMenu details[open] > summary::after{content:"−"}',
    '#ehMobileMenu details ul{padding:0 0 10px 4px}',
    '#ehMobileMenu details ul li a{padding:10px 0;font-size:14px}',
    '#ehMobileMenu .eh-kr-chip{display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid #34d298;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#34d298}',
    '#ehMobileMenu .eh-lang{margin:16px 0 !important;font-family:inherit !important;font-size:12px !important;font-weight:600 !important;color:#fff !important;background-color:rgba(255,255,255,.08) !important;background-image:linear-gradient(transparent,transparent) !important;border:1px solid rgba(255,255,255,.15) !important;border-radius:20px !important;padding:5px 12px !important;outline:none !important;width:auto !important;height:auto !important;min-height:0 !important;box-sizing:border-box !important;-webkit-appearance:none !important;-moz-appearance:none !important;appearance:none !important;cursor:pointer !important}',
    '#ehMobileMenu .eh-lang option{background:#171717 !important;color:#fff !important}',
    '#ehMobileMenu .eh-lang::-ms-expand{display:none !important}',
    /* Responsive swap — matches index.html breakpoint.
       On mobile the four nav dropdowns collapse into the hamburger menu,
       but the language <select> stays visible in the top bar (index.html
       uses `order: -1` on .nav-right .lang-sel to slot it before the
       hamburger). Source order in our markup is already [lang, ham] so
       no `order` override is needed. */
    '@media (max-width:680px){#ehNav .eh-nav-links{display:none}#ehNav .eh-ham{display:flex}}',
    /* `--ergsn-bottom-cta-h` mirrors index.html's `--bottom-cta-h` — 0 on
       desktop, 60 px on mobile so the bottom-right FAB stack clears the
       iOS Safari browser chrome the same way the homepage does. */
    ':root{--ergsn-bottom-cta-h:0px}',
    '@media (max-width:760px){:root{--ergsn-bottom-cta-h:60px}}',
    /* Back-to-top FAB — mirrors index.html's policy exactly: by default
       only the chat FAB shows; once the page scrolls past ~400 px the
       Top FAB appears in the spot the chat FAB was in and the chat FAB
       rises above it via `--ergsn-chat-lift`. */
    '#ehToTop{position:fixed;right:clamp(16px,3vw,32px);bottom:calc(clamp(16px,3vw,32px) + var(--ergsn-bottom-cta-h, 0px));width:48px;height:48px;background:#171717;color:#34d298;border:1px solid #292929;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -10px rgba(0,0,0,.55);cursor:pointer;opacity:0;visibility:hidden;transform:translateY(12px);transition:opacity .25s ease,transform .25s ease,visibility .25s,background .15s,color .15s;z-index:800}',
    '#ehToTop.eh-visible{opacity:1;visibility:visible;transform:translateY(0)}',
    '#ehToTop:hover{background:#34d298;color:#0f1110}',
    '#ehToTop svg{width:20px;height:20px}',
    '@media (max-width:600px){#ehToTop{width:44px;height:44px}}',
    /* Chat FAB position override — lifts by `--ergsn-chat-lift` (set by
       the scroll listener in this file) so it sits above the Top FAB
       once it appears. Also adds the same mobile `--ergsn-bottom-cta-h`
       offset so both FABs sit at matching heights. !important beats
       the scoped rule injected by scripts/chat.js. */
    '#chatToggle{bottom:calc(clamp(16px,3vw,32px) + var(--ergsn-bottom-cta-h, 0px) + var(--ergsn-chat-lift, 0px)) !important;transition:bottom .3s ease, transform .2s, box-shadow .2s !important}',
    '#chatPanel{bottom:calc(84px + var(--ergsn-bottom-cta-h, 0px) + var(--ergsn-chat-lift, 0px)) !important}',
    /* Chat FAB (#chatToggle) is injected by scripts/chat.js instead —
       that module owns the full Trade Advisor so the bottom-right
       behaves identically to index.html (in-place open, not redirect). */
    /* Retire the duplicate bottom-right "Back to ERGSN" link on every
       standalone page — the Top FAB + header logo now handle that
       affordance, and the text link would collide with the Chat FAB. */
    '.ergsn-back-bottom{display:none !important}',
    /* Move the inline top-left back link to the right of the content
       area. Matches the user-validated layout: logo at top-left (inside
       the injected header), breadcrumb-style back link at top-right of
       the page body. */
    '.back,.vh-back{display:block !important;width:fit-content !important;margin-left:auto !important;margin-right:0 !important;text-align:right !important}',
    /* `.ergsn-back-top` is a fixed-position floating back button on
       invoice-template / verified-certificate. The header logo already
       covers "back to home", and the .tools action cluster occupies the
       top-right of those pages, so keep this retired. */
    '.ergsn-back-top{display:none !important}',
    /* Hide in print so spec sheets / invoices stay clean */
    '@media print{#ehNav,#ehMobileMenu,#ehToTop,.ergsn-back-top{display:none !important}body{padding-top:0 !important}}'
  ].join('');

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildDesktopItem(it) {
    if (it.divider) return '<li class="eh-ds-divider" role="separator"></li>';
    var extAttrs = it.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    var tagHtml = '';
    if (it.tag) {
      var tagCls = it.tagSoon ? 'eh-ds-tag eh-soon' : 'eh-ds-tag';
      tagHtml = ' <span class="' + tagCls + '">' + escapeHTML(it.tag) + '</span>';
    }
    var krChip = it.kr ? '<span class="eh-kr-chip">KR</span>' : '';
    return (
      '<li>' +
        '<a href="' + escapeHTML(it.href) + '"' + extAttrs + '>' +
          '<span class="eh-ds-name">' + krChip + escapeHTML(it.name) + tagHtml + '</span>' +
          (it.desc ? '<span class="eh-ds-desc">' + escapeHTML(it.desc) + '</span>' : '') +
        '</a>' +
      '</li>'
    );
  }

  function buildDesktopNav() {
    var dropdowns = MENU.map(function (col) {
      var items = col.items.map(buildDesktopItem).join('');
      return (
        '<li class="eh-nav-dropdown">' +
          '<a href="' + escapeHTML(col.href) + '">' + escapeHTML(col.title) + '</a>' +
          '<ul class="eh-nav-dropmenu">' + items + '</ul>' +
        '</li>'
      );
    }).join('');
    return (
      '<ul class="eh-nav-links">' +
        dropdowns +
        '<li><a href="index.html#rfq" class="eh-nav-cta">Request Quote</a></li>' +
      '</ul>'
    );
  }

  var LANG_OPTIONS =
    '<option value="en">EN</option>' +
    '<option value="es">ES</option>' +
    '<option value="ar">عربي</option>' +
    '<option value="fr">FR</option>' +
    '<option value="ja">日本語</option>' +
    '<option value="tr">TR</option>' +
    '<option value="zh-Hans">简体</option>' +
    '<option value="zh-Hant">繁體</option>';

  function buildMobileItem(it) {
    if (it.divider) return '';
    var extAttrs = it.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    var krChip = it.kr ? '<span class="eh-kr-chip">KR</span>' : '';
    var tag = it.tag ? ' <span class="eh-ds-tag' + (it.tagSoon ? ' eh-soon' : '') + '">' + escapeHTML(it.tag) + '</span>' : '';
    return (
      '<li><a href="' + escapeHTML(it.href) + '"' + extAttrs + '>' + krChip + escapeHTML(it.name) + tag + '</a></li>'
    );
  }

  function buildMobileMenu() {
    /* All four sections render collapsed by default — matches index.html
       exactly (its mobile-menu <details> blocks carry no `open` attr).
       The previous default of auto-opening Shop meant users always had
       to close Shop first before expanding another section. */
    var sections = MENU.map(function (col) {
      var lis = col.items.map(buildMobileItem).join('');
      return (
        '<details>' +
          '<summary>' + escapeHTML(col.title) + '</summary>' +
          '<ul>' + lis + '</ul>' +
        '</details>'
      );
    }).join('');
    return (
      '<div id="ehMobileMenu" aria-hidden="true">' +
        sections +
        '<select class="eh-lang" aria-label="Language">' + LANG_OPTIONS + '</select>' +
      '</div>'
    );
  }

  function buildNav() {
    return (
      '<nav id="ehNav" role="banner">' +
        '<div class="eh-inner">' +
          '<a href="index.html" class="eh-logo" aria-label="ERGSN home">' +
            '<span class="eh-logo-mark"><span class="eh-e">E</span>RGSN</span>' +
          '</a>' +
          '<div class="eh-right">' +
            buildDesktopNav() +
            '<select class="eh-lang" aria-label="Language">' + LANG_OPTIONS + '</select>' +
            '<button type="button" class="eh-ham" aria-label="Menu" aria-expanded="false" aria-controls="ehMobileMenu">' +
              '<span></span><span></span><span></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</nav>'
    );
  }

  var TO_TOP_MARKUP = (
    '<button id="ehToTop" type="button" aria-label="Back to top">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>' +
    '</button>'
  );

  function inject() {
    if (!document.body) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildNav() + buildMobileMenu();
    var nodes = Array.prototype.slice.call(wrapper.children);
    // Insert at body start, preserving order
    for (var i = nodes.length - 1; i >= 0; i--) {
      document.body.insertBefore(nodes[i], document.body.firstChild);
    }

    /* Append only the Top FAB — Chat FAB comes from scripts/chat.js */
    var fabWrap = document.createElement('div');
    fabWrap.innerHTML = TO_TOP_MARKUP;
    while (fabWrap.firstChild) document.body.appendChild(fabWrap.firstChild);

    var toTop = document.getElementById('ehToTop');
    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      var ticking = false;
      var docRoot = document.documentElement;
      function updateToTop() {
        var y = window.scrollY || document.documentElement.scrollTop;
        var show = y > 400;
        toTop.classList.toggle('eh-visible', show);
        /* When the Top FAB is visible, push the chat FAB above it by
           48 px (FAB height) + 12 px gap = 60 px, matching index.html's
           updateBottomStack(). When hidden, chat sits flush at the
           bottom. */
        docRoot.style.setProperty('--ergsn-chat-lift', show ? '60px' : '0px');
        ticking = false;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { window.requestAnimationFrame(updateToTop); ticking = true; }
      }, { passive: true });
      updateToTop();
    }

    var ham = document.querySelector('#ehNav .eh-ham');
    var menu = document.getElementById('ehMobileMenu');
    function closeMenu() {
      if (!menu) return;
      menu.classList.remove('eh-open');
      menu.setAttribute('aria-hidden', 'true');
      if (ham) { ham.classList.remove('eh-open'); ham.setAttribute('aria-expanded', 'false'); }
    }
    if (ham && menu) {
      ham.addEventListener('click', function () {
        var nowOpen = !menu.classList.contains('eh-open');
        menu.classList.toggle('eh-open', nowOpen);
        ham.classList.toggle('eh-open', nowOpen);
        ham.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        menu.setAttribute('aria-hidden', nowOpen ? 'false' : 'true');
      });
      menu.addEventListener('click', function (e) {
        if (e.target && e.target.tagName === 'A') closeMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('eh-open')) closeMenu();
      });
    }

    var langs = document.querySelectorAll('#ehNav .eh-lang, #ehMobileMenu .eh-lang');
    try {
      var saved = localStorage.getItem('ergsn_lang');
      if (saved) {
        langs.forEach(function (sel) {
          for (var j = 0; j < sel.options.length; j++) {
            if (sel.options[j].value === saved) { sel.value = saved; break; }
          }
        });
      }
    } catch (_) {}
    langs.forEach(function (sel) {
      sel.addEventListener('change', function () {
        var target = sel.value;
        try { localStorage.setItem('ergsn_lang', target); } catch (_) {}
        if (typeof window.setLang === 'function') { window.setLang(target); return; }
        window.location.href = 'index.html';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
