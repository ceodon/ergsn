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
      ${showPack ? '<th>Cartons</th><th>Net kg</th><th>Gross kg</th><th>Dims (LxWxH cm)</th><th>Marks &amp; Nos.</th>' : ''}
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
        <td><input class="dims" placeholder="60x40x30" value="${esc(it.dims || '')}"></td>
        <td><input class="marks" placeholder="ERGSN/SEL/1-N" value="${esc(it.marks || '')}"></td>
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
        r.ctns  = +tr.querySelector('.ctns').value || 0;
        r.nw    = +tr.querySelector('.nw').value   || 0;
        r.gw    = +tr.querySelector('.gw').value   || 0;
        r.dims  = tr.querySelector('.dims').value;
        r.marks = tr.querySelector('.marks').value;
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

/* ─── State machine — which transitions are allowed from each status.
       Mirrors backend enforcement in cloudflare-worker-trade-docs.js. ─── */
const STATUS_NEXT = {
  open:                ['quoted', 'cancelled'],
  quoted:              ['po-received', 'cancelled'],
  'po-received':       ['proforma-sent', 'cancelled'],
  'proforma-sent':     ['paid', 'cancelled'],
  paid:                ['commercial-issued', 'cancelled'],
  'commercial-issued': ['packing-issued', 'cancelled'],
  'packing-issued':    ['shipped', 'cancelled'],
  shipped:             ['closed', 'cancelled'],
  closed:              [],
  cancelled:           []
};

/* ─── Per-doc-type print HTML — used by trade-doc.html (preview before
       send) and trade-doc-view.html (buyer-facing readonly view). ─── */
function buildPrintHtml(type, tx, data, docId) {
  const meta = DOC_META[type];
  const items = (data.items || []).map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${esc(r.desc || '')}</td>
      ${type==='commercial' ? `<td>${esc(r.hs || '')}</td>` : ''}
      <td style="text-align:right">${fmt(r.qty, 0)} ${esc(r.unit || '')}</td>
      <td style="text-align:right">${fmt(r.up)}</td>
      <td style="text-align:right">${fmt(r.amt)}</td>
      ${type==='packing' ? `<td style="text-align:right">${fmt(r.ctns,0)}</td><td style="text-align:right">${fmt(r.nw)}</td><td style="text-align:right">${fmt(r.gw)}</td><td>${esc(r.dims || '')}</td><td>${esc(r.marks || '')}</td>` : ''}
    </tr>`).join('');
  const extras = (() => {
    if (type === 'commercial') return `<p>
      <b>B/L:</b> ${esc(data.bl_number||'')} &middot; <b>Container:</b> ${esc(data.container_no||'')} &middot;
      <b>Incoterms:</b> ${esc(data.incoterms||'')} &middot; <b>COO:</b> ${esc(data.coo||'')}<br>
      ${data.port_loading ? '<b>POL:</b> ' + esc(data.port_loading) + ' &middot; ' : ''}
      ${data.port_discharge ? '<b>POD:</b> ' + esc(data.port_discharge) + ' &middot; ' : ''}
      ${data.vessel ? '<b>Vessel:</b> ' + esc(data.vessel) + (data.voyage ? ' (' + esc(data.voyage) + ')' : '') : ''}
      ${data.consignee ? '<br><b>Consignee:</b> ' + esc(data.consignee) : ''}
      ${data.notify_party ? '<br><b>Notify:</b> ' + esc(data.notify_party) : ''}
      ${data.shipping_marks ? '<br><b>Shipping Marks:</b> ' + esc(data.shipping_marks) : ''}
    </p>`;
    if (type === 'packing')    return `<p><b>Cartons:</b> ${data.carton_count||''} &middot; <b>Net:</b> ${fmt(data.total_net_kg)} kg &middot; <b>Gross:</b> ${fmt(data.total_weight_kg)} kg &middot; <b>Vol:</b> ${fmt(data.total_volume_m3)} m³</p>`;
    if (type === 'quotation')  return data.valid_until ? `<p><b>Valid until:</b> ${new Date(data.valid_until).toISOString().slice(0,10)}</p>` : '';
    if (type === 'proforma')   return `<p>
      <b>Payment Terms:</b> ${esc(data.payment_terms||'')} &middot; <b>Delivery:</b> ${esc(data.delivery||'')}
      ${data.bank_name ? '<br><b>Bank:</b> ' + esc(data.bank_name) : ''}
      ${data.bank_account ? '<br><b>Account:</b> ' + esc(data.bank_account) : ''}
      ${data.bank_swift ? '<br><b>SWIFT:</b> ' + esc(data.bank_swift) : ''}
      ${data.bank_iban ? '<br><b>IBAN:</b> ' + esc(data.bank_iban) : ''}
      ${data.bank_beneficiary ? '<br><b>Beneficiary:</b> ' + esc(data.bank_beneficiary) : ''}
    </p>`;
    if (type === 'po')         return data.buyer_ref ? `<p><b>Buyer Ref:</b> ${esc(data.buyer_ref)}</p>` : '';
    return '';
  })();
  const subtotal     = data.subtotal != null ? data.subtotal : (data.items || []).reduce((s,r) => s + (r.amt||0), 0);
  const discount     = data.discount || 0;
  const taxPct       = data.tax_pct || 0;
  const total_amount = data.total_amount != null ? data.total_amount : (subtotal - discount) * (1 + taxPct/100);

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#000;font-size:12px;line-height:1.4">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f0f0f;padding-bottom:8px;margin-bottom:14px">
        <div style="font-size:22px;font-weight:800;letter-spacing:.04em"><span style="color:#34d298">E</span>RGSN</div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800">${meta.title_en}</div>
          <div style="font-size:11px;color:#666">${meta.title_ko} &middot; ${esc(docId || '')} &middot; TX ${esc(tx.id || '')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;font-size:11px">
        <div>
          <div style="font-weight:700;color:#34d298;text-transform:uppercase;letter-spacing:.1em;font-size:10px;margin-bottom:4px">Seller</div>
          ERGSN CO., LTD.<br>
          #503 Susong BD, 12-21, Seoae-ro 5-gil<br>
          Joong-gu, Seoul 04623, Republic of Korea<br>
          ergsn.net
        </div>
        <div>
          <div style="font-weight:700;color:#34d298;text-transform:uppercase;letter-spacing:.1em;font-size:10px;margin-bottom:4px">Buyer</div>
          ${esc(tx.buyer_company || '')}<br>
          ${esc(tx.buyer_email || '')}<br>
          ${esc(tx.buyer_country || '')}
        </div>
      </div>
      <div style="margin-bottom:8px;font-size:11px"><b>Document Date:</b> ${esc(data.document_date || '')} &middot; <b>Currency:</b> ${esc(data.currency || '')} &middot; <b>Maker:</b> ${esc(tx.ergsn_partner || '')}</div>
      ${extras}
      <table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:11px">
        <thead style="background:#0f0f0f;color:#fff">
          <tr>
            <th style="padding:6px;text-align:left">#</th><th style="padding:6px;text-align:left">Description</th>
            ${type==='commercial' ? '<th style="padding:6px">HS</th>' : ''}
            <th style="padding:6px;text-align:right">Qty</th>
            <th style="padding:6px;text-align:right">Unit Price</th>
            <th style="padding:6px;text-align:right">Amount</th>
            ${type==='packing' ? '<th>Ctns</th><th>NW</th><th>GW</th><th>Dims</th><th>Marks</th>' : ''}
          </tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
      <div style="margin-left:auto;width:260px;font-family:ui-monospace,Menlo,monospace;font-size:12px;border-top:2px solid #0f0f0f;padding-top:6px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${fmt(discount)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Tax (${taxPct}%)</span><span>${fmt((subtotal-discount)*taxPct/100)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#34d298;border-top:1px solid #0f0f0f;padding-top:4px;margin-top:4px"><span>Total</span><span>${fmt(total_amount)}</span></div>
      </div>
      ${data.notes ? `<div style="margin-top:18px;font-size:11px;border-top:1px dashed #999;padding-top:8px"><b>Notes:</b> ${esc(data.notes)}</div>` : ''}
      <div style="margin-top:30px;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:6px">© 2013 ERGSN CO., LTD. &middot; ergsn.net &middot; Generated ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC</div>
    </div>`;
}

/* ─── public ─── */
return {
  API_URL, MAIL_URL, DOC_META, STATUS_LABELS, STATUS_NEXT,
  adminKey, setAdminKey, clearAdminKey,
  apiAdmin, apiBuyer, apiBuyerPO, sendBrandMail,
  esc, fmt, fmtDate,
  renderLineItems, buildPrintHtml
};

})();
