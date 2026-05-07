/* ─────────────────────────────────────────────────────────────────
   ERGSN export-doc templates — brand customization (logo + name).
   Loaded by invoice/proforma/packing-list/co templates.

   Behavior:
   - Default brand: ERGSN + "Korea · Trade Gateway · Since 2013"
   - User can edit company name/subtitle inline (text inputs)
   - User can upload a logo image (replaces text); 'Reset' restores default
   - All changes persist in localStorage and apply to all 4 templates
   ───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'ergsn-template-brand';
  var DEFAULTS = {
    name: 'ERGSN',
    sub:  'Korea · Trade Gateway · Since 2013',
    image: null
  };

  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function save(brand) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(brand)); }
    catch (_) {}
  }

  function applyBrand() {
    var brand = loadSaved();
    var nameEl = document.getElementById('brandName');
    var subEl  = document.getElementById('brandSub');
    var imgEl  = document.getElementById('brandImage');

    if (nameEl) nameEl.value = (brand.name != null) ? brand.name : DEFAULTS.name;
    if (subEl)  subEl.value  = (brand.sub  != null) ? brand.sub  : DEFAULTS.sub;

    if (imgEl) {
      if (brand.image) {
        imgEl.src = brand.image;
        imgEl.classList.add('show');
      } else {
        imgEl.removeAttribute('src');
        imgEl.classList.remove('show');
      }
    }
  }

  window.handleLogoUpload = function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image must be under 2 MB. Please pick a smaller file.');
      event.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var brand = loadSaved();
      brand.image = e.target.result;
      save(brand);
      applyBrand();
    };
    reader.onerror = function () {
      alert('Could not read that file. Please try a different image.');
    };
    reader.readAsDataURL(file);
    event.target.value = ''; /* allow re-upload of the same filename */
  };

  window.handleBrandTextChange = function () {
    var nameEl = document.getElementById('brandName');
    var subEl  = document.getElementById('brandSub');
    var brand = loadSaved();
    if (nameEl) brand.name = nameEl.value;
    if (subEl)  brand.sub  = subEl.value;
    save(brand);
  };

  window.resetBrand = function () {
    if (!window.confirm('Reset brand to ERGSN default? This clears your saved company name, subtitle, and logo on all four templates.')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    applyBrand();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand);
  } else {
    applyBrand();
  }

  /* ── Defensive print hide (whitelist) ─────────────────────────
     Earlier versions targeted specific IDs like #ehNav / #ergsnFooter,
     but header.js also injects #ehMobileMenu (and other scripts inject
     more); a selector blacklist always misses something and the missed
     element bleeds into print as a dark band. Switch to a WHITELIST:
     hide every direct body child except .doc itself, plus inert tags
     (script/style/link). Inline `display:none !important` beats every
     cached CSS rule. Restored on afterprint. */
  function isInert(el) {
    var t = el.tagName;
    return t === 'SCRIPT' || t === 'STYLE' || t === 'LINK' || t === 'NOSCRIPT';
  }

  window.addEventListener('beforeprint', function () {
    /* Force html + body to white background via inline style. PC Chrome
       leaks the screen-mode body bg (#20201b dark) into PDF output when
       "Background graphics" print option is ON, despite @media print
       overrides. Inline style with !important wins all cascades. */
    document.documentElement.setAttribute(
      'data-prev-html-style',
      document.documentElement.getAttribute('style') || ''
    );
    document.documentElement.style.setProperty('background', '#fff', 'important');
    document.body.setAttribute('data-prev-body-style', document.body.getAttribute('style') || '');
    document.body.style.setProperty('background', '#fff', 'important');

    /* Hide every body child except .doc (whitelist) */
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (isInert(el)) continue;
      if (el.classList && el.classList.contains('doc')) continue;
      el.setAttribute('data-prev-style', el.getAttribute('style') || '');
      el.style.setProperty('display', 'none', 'important');
    }
  });

  window.addEventListener('afterprint', function () {
    /* Restore html + body backgrounds */
    var prevHtml = document.documentElement.getAttribute('data-prev-html-style');
    if (prevHtml !== null) {
      if (prevHtml) document.documentElement.setAttribute('style', prevHtml);
      else document.documentElement.removeAttribute('style');
      document.documentElement.removeAttribute('data-prev-html-style');
    }
    var prevBody = document.body.getAttribute('data-prev-body-style');
    if (prevBody !== null) {
      if (prevBody) document.body.setAttribute('style', prevBody);
      else document.body.removeAttribute('style');
      document.body.removeAttribute('data-prev-body-style');
    }

    /* Restore other body children */
    var nodes = document.querySelectorAll('[data-prev-style]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var prev = el.getAttribute('data-prev-style');
      if (prev) { el.setAttribute('style', prev); }
      else { el.removeAttribute('style'); }
      el.removeAttribute('data-prev-style');
    }
  });
})();
