/* ERGSN Trade Documentation — shared helpers
 * Loaded by trade-docs.html, trade-doc.html, trade-buyer.html, trade-doc-po.html
 * Provides: API client (admin / buyer), line-item table, PDF print, brand-mail send.
 */

window.TD = (function () {

const API_URL  = 'https://ergsn-trade-docs.ceodon.workers.dev';
const MAIL_URL = 'https://ergsn-mail.ceodon.workers.dev/admin-send';
const ADMIN_SS = 'ergsn_admin_key';

const DOC_META = {
  quotation:  { title_en: 'Quotation',          title_ko: '견적서',         prefix: 'Q' },
  po:         { title_en: 'Purchase Order',     title_ko: '발주서',         prefix: 'PO' },
  proforma:   { title_en: 'Proforma Invoice',   title_ko: '견적송장',       prefix: 'PI' },
  commercial: { title_en: 'Commercial Invoice', title_ko: '상업송장',       prefix: 'CI' },
  packing:    { title_en: 'Packing List',       title_ko: '포장명세서',     prefix: 'PL' }
};

/* ─── auth + api ─── */
function adminKey()  { try { return sessionStorage.getItem(ADMIN_SS) || ''; } catch (_) { return ''; } }
function setAdminKey(k) { try { sessionStorage.setItem(ADMIN_SS, k); } catch (_) {} }
function clearAdminKey() { try { sessionStorage.removeItem(ADMIN_SS); } catch (_) {} }

async function apiAdmin(method, path, body) {
  const r = await fetch(API_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Admin-Key': adminKey()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { clearAdminKey(); throw new Error('unauthorized'); }
  if (!r.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

async function apiBuyer(token) {
  const r = await fetch(API_URL + '/buyer?t=' + encodeURIComponent(token));
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

async function apiBuyerPO(token, data) {
  const r = await fetch(API_URL + '/buyer/po', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ token, data })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

/* ─── brand-mail send (admin) ─── */
async function sendBrandMail(payload) {
  const r = await fetch(MAIL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Admin-Key': adminKey()
    },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

/* ─── helpers ─── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmt(n, d = 2) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n);
  if (!isFinite(v)) return '';
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(ms) {
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/* ─── line items table — used by all 5 doc types ─── */
function renderLineItems(container, items, opts) {
  opts = opts || {};
  const showHs    = !!opts.showHs;
  const showPack  = !!opts.showPack;
  const onChange  = opts.onChange || (() => {});
  container.innerHTML = '';
  const tbl = document.createElement('table');
  tbl.className = 'tdli';
  tbl.innerHTML = `
    <thead><tr>
      <th>#</th><th>Description</th>
      ${showHs ? '<th>HS Code</th>' : ''}
      <th>Qty</th><th>Unit</th><th>Unit Price</th><th>Amount</th>
      ${showPack ? '<th>Cartons</th><th>Net kg</th><th>Gross kg</th>' : ''}
      <th></th></tr></thead><tbody></tbody>`;
  container.appendChild(tbl);
  const tbody = tbl.querySelector('tbody');
  function recalc() {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((tr, i) => {
      tr.querySelector('.idx').textContent = i + 1;
      const qty  = +tr.querySelector('.qty').value  || 0;
      const unit = +tr.querySelector('.up').value || 0;
      tr.querySelector('.amt').textContent = fmt(qty * unit);
    });
    onChange();
  }
  function addRow(it) {
    it = it || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="idx"></td>
      <td><input class="desc" value="${esc(it.desc || '')}" placeholder="Description"></td>
      ${showHs ? `<td><input class="hs" value="${esc(it.hs || '')}" placeholder="HS"></td>` : ''}
      <td><input class="qty" type="number" min="0" step="any" value="${esc(it.qty || '')}"></td>
      <td><input class="unit" value="${esc(it.unit || 'EA')}"></td>
      <td><input class="up" type="number" min="0" step="any" value="${esc(it.up || '')}"></td>
      <td class="amt">0.00</td>
      ${showPack ? `
        <td><input class="ctns" type="number" min="0" value="${esc(it.ctns || '')}"></td>
        <td><input class="nw" type="number" min="0" step="any" value="${esc(it.nw || '')}"></td>
        <td><input class="gw" type="number" min="0" step="any" value="${esc(it.gw || '')}"></td>
      ` : ''}
      <td><button type="button" class="rm">×</button></td>`;
    tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', recalc));
    tr.querySelector('.rm').addEventListener('click', () => { tr.remove(); recalc(); });
    tbody.appendChild(tr);
    recalc();
  }
  function getRows() {
    const rows = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const r = {
        desc: tr.querySelector('.desc').value,
        qty:  +tr.querySelector('.qty').value || 0,
        unit: tr.querySelector('.unit').value,
        up:   +tr.querySelector('.up').value || 0
      };
      if (showHs)   r.hs = tr.querySelector('.hs').value;
      if (showPack) {
        r.ctns = +tr.querySelector('.ctns').value || 0;
        r.nw   = +tr.querySelector('.nw').value   || 0;
        r.gw   = +tr.querySelector('.gw').value   || 0;
      }
      r.amt = r.qty * r.up;
      rows.push(r);
    });
    return rows;
  }
  (items || [{}]).forEach(addRow);
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tdli-add';
  addBtn.textContent = '+ Add line';
  addBtn.addEventListener('click', () => addRow({}));
  container.appendChild(addBtn);
  return { getRows, recalc, addRow };
}

/* ─── status step labels ─── */
const STATUS_LABELS = {
  open:               'Open',
  quoted:             'Quoted',
  'po-received':      'P/O received',
  'proforma-sent':    'Proforma sent',
  paid:               'Paid',
  'commercial-issued':'Commercial issued',
  'packing-issued':   'Packing issued',
  shipped:            'Shipped',
  closed:             'Closed',
  cancelled:          'Cancelled'
};

/* ─── public ─── */
return {
  API_URL, MAIL_URL, DOC_META, STATUS_LABELS,
  adminKey, setAdminKey, clearAdminKey,
  apiAdmin, apiBuyer, apiBuyerPO, sendBrandMail,
  esc, fmt, fmtDate,
  renderLineItems
};

})();
