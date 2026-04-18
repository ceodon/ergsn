/* ERGSN shared chatbot loader — injects the Trade Advisor FAB + panel
   + CSS on any standalone page, then loads scripts/chat-core.js which
   carries the verbatim P catalog and chat state machine from
   index.html. This makes the bottom-right chat affordance open in place
   (no redirect) and feel identical to the homepage.

   Bails out completely on index.html where the chat is already defined
   inline (detected via `typeof chatOpen !== 'undefined'` or the existing
   `#chatToggle` element), so the homepage keeps its own copy untouched.

   Stubs are provided for functions that only exist on index.html
   (openModal, switchSector, requestQuote, toast, sendTG, …) so chat
   actions that can't run locally gracefully redirect home instead of
   throwing. */
(function () {
  if (window.__ergsnChatLoaded) return;
  if (typeof window.chatOpen !== 'undefined' || document.getElementById('chatToggle')) return;
  window.__ergsnChatLoaded = true;

  var CSS = [
    '#chatToggle{position:fixed;right:clamp(16px,3vw,32px);bottom:clamp(16px,3vw,32px);width:52px;height:52px;background:#34d298;color:#0f1110;border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(52,210,152,.4);cursor:pointer;z-index:800;transition:transform .2s,box-shadow .2s}',
    '#chatToggle:hover{transform:scale(1.08);box-shadow:0 8px 32px rgba(52,210,152,.55)}',
    '#chatToggle svg{width:24px;height:24px}',
    '#chatPanel{position:fixed;right:clamp(16px,3vw,32px);bottom:84px;width:min(360px,calc(100vw - 32px));max-height:480px;background:#171717;border:2px solid #34d298;border-radius:16px;overflow:hidden;box-shadow:0 0 30px rgba(52,210,152,.2),0 20px 60px rgba(0,0,0,.6);z-index:810;display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    '#chatPanel.open{display:flex}',
    '#chatPanel *{box-sizing:border-box}',
    '#chatPanel .chat-hd{background:#111418;padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #292929}',
    '#chatPanel .chat-hd-dot{width:10px;height:10px;background:#34d298;border-radius:50%;flex-shrink:0}',
    '#chatPanel .chat-hd-title{font-size:14px;font-weight:600;color:#fff;margin:0}',
    '#chatPanel .chat-hd-sub{font-size:11px;color:#6b7685;margin:0}',
    '#chatPanel .chat-close{margin-left:auto;color:#6b7685;font-size:18px;cursor:pointer;transition:color .15s;background:transparent;border:0;padding:0;line-height:1}',
    '#chatPanel .chat-close:hover{color:#fff}',
    '#chatPanel .chat-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;max-height:340px}',
    '#chatPanel .chat-msg{max-width:85%;padding:10px 14px;font-size:13px;line-height:1.55;border-radius:14px;animation:ergChatPop .25s ease;white-space:pre-line;margin:0}',
    '@keyframes ergChatPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
    '#chatPanel .chat-msg.bot{background:#232524;color:#cfcfcf;border-bottom-left-radius:4px;align-self:flex-start}',
    '#chatPanel .chat-msg.user{background:#34d298;color:#0f1110;font-weight:500;border-bottom-right-radius:4px;align-self:flex-end}',
    '#chatPanel .chat-options{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;animation:ergChatPop .25s ease}',
    '#chatPanel .chat-opt{font-family:inherit;font-size:12px;font-weight:500;background:#002c1c;color:#34d298;border:1px solid #34d298;border-radius:20px;padding:7px 14px;cursor:pointer;transition:background .15s,color .15s}',
    '#chatPanel .chat-opt:hover{background:#34d298;color:#0f1110}',
    '#chatPanel .chat-opt-back{background:transparent;color:#cfcfcf;border-color:#3a3a3a;opacity:.75}',
    '#chatPanel .chat-opt-back:hover{background:#232524;color:#f0f0f0;border-color:#cfcfcf;opacity:1}',
    '#chatPanel .chat-typing{display:flex;gap:4px;align-self:flex-start;padding:10px 14px;background:#232524;border-radius:14px;border-bottom-left-radius:4px}',
    '#chatPanel .chat-typing span{width:6px;height:6px;background:#6b7685;border-radius:50%;animation:ergTypingDot .8s ease-in-out infinite}',
    '#chatPanel .chat-typing span:nth-child(2){animation-delay:.15s}',
    '#chatPanel .chat-typing span:nth-child(3){animation-delay:.3s}',
    '@keyframes ergTypingDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
    '#chatPanel .chat-input-row{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #292929;background:#111}',
    '#chatPanel .chat-input{flex:1;background:#1d1d1d;border:1px solid #292929;color:#fff;border-radius:20px;padding:9px 16px;font-family:inherit;font-size:13px;outline:none;transition:border-color .15s;margin:0;width:auto;height:auto}',
    '#chatPanel .chat-input:focus{border-color:#34d298}',
    '#chatPanel .chat-input::placeholder{color:#8a8b8d}',
    '#chatPanel .chat-send{background:#34d298;color:#0f1110;border:none;border-radius:50%;width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;padding:0}',
    '#chatPanel .chat-send:hover{background:#00ffa1}',
    '#chatPanel .chat-send svg{width:16px;height:16px}',
    '@media print{#chatToggle,#chatPanel{display:none !important}}'
  ].join('');

  var HTML = (
    '<button id="chatToggle" type="button" aria-label="Product advisor" onclick="toggleChat()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '<path d="M8 9h.01M12 9h.01M16 9h.01"/>' +
      '</svg>' +
    '</button>' +
    '<div id="chatPanel" role="dialog" aria-modal="false" aria-label="ERGSN Trade Advisor" aria-hidden="true">' +
      '<div class="chat-hd">' +
        '<span class="chat-hd-dot"></span>' +
        '<div><p class="chat-hd-title">ERGSN Trade Advisor</p><p class="chat-hd-sub">K-Security \u00B7 K-Tech \u00B7 K-Energy \u00B7 K-Bio</p></div>' +
        '<button class="chat-close" onclick="toggleChat()" aria-label="Close chat">\u00D7</button>' +
      '</div>' +
      '<div class="chat-body" id="chatBody"></div>' +
      '<div class="chat-input-row">' +
        '<input class="chat-input" id="chatInput" type="text" placeholder="Type a question..." autocomplete="off" onkeydown="if(event.key===\'Enter\')handleChatInput()">' +
        '<button class="chat-send" onclick="handleChatInput()" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button>' +
      '</div>' +
    '</div>'
  );

  /* Stubs for functions that only live on index.html. On standalone
     pages, any chat action that would normally invoke them redirects to
     the corresponding page on the homepage instead of throwing. */
  function installStubs() {
    if (typeof window.openModal !== 'function') {
      window.openModal = function () { window.location.href = 'index.html#products'; };
    }
    if (typeof window.switchSector !== 'function') {
      window.switchSector = function () { window.location.href = 'index.html#products'; };
    }
    if (typeof window.requestQuote !== 'function') {
      window.requestQuote = function () { window.location.href = 'index.html#rfq'; return false; };
    }
    if (typeof window.toast !== 'function') {
      window.toast = function (msg) { try { console.log('[toast]', msg); } catch (_) {} };
    }
    if (typeof window.sendTG !== 'function') {
      window.sendTG = function () {};
    }
    if (typeof window.withViewTransition !== 'function') {
      window.withViewTransition = function (fn) { if (typeof fn === 'function') fn(); };
    }
    if (typeof window.closeCompareModal !== 'function') {
      window.closeCompareModal = function () {};
    }
    if (typeof window.offerMatch !== 'function') {
      window.offerMatch = function () { window.location.href = 'index.html#match'; };
    }
    if (typeof window.resetRFQForm !== 'function') {
      window.resetRFQForm = function () {};
    }
    if (typeof window.onIncotermsChange !== 'function') {
      window.onIncotermsChange = function () {};
    }
    if (typeof window.onCountryChange !== 'function') {
      window.onCountryChange = function () {};
    }
  }

  /* Post-load overrides — chat-core defines its own chatPrefillAndQuote
     which tries to scrollIntoView `#rfq` on the homepage. Standalone
     pages don't have that section, so after chat-core runs we replace
     it with a redirect so the button still does something sensible. */
  function installPostLoadOverrides() {
    if (!document.getElementById('rfq')) {
      window.chatPrefillAndQuote = function () { window.location.href = 'index.html#rfq'; };
    }
  }

  function init() {
    if (!document.body) return;
    installStubs();
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    /* Load the chat core after the HTML exists so its DOMContentLoaded
       handlers (if any) can wire up correctly. Using a fresh <script>
       tag runs chat-core.js at top-level script scope — same as if it
       were inlined — so `const P = {...}`, `let chatOpen`, and
       `function toggleChat()` all land as globals exactly like on
       index.html. */
    var s = document.createElement('script');
    s.src = 'scripts/chat-core.js';
    s.async = false;
    s.onload = installPostLoadOverrides;
    document.body.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
