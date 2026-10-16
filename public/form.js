// FCW CRM landing page helper. Add to the landing page:
//   <script src="https://fcw-crm.onrender.com/form.js" data-key="YOUR_FORM_KEY" async></script>
// It remembers which ad brought the visitor (gclid, fbclid, utm_*), and when any form on the page
// is submitted it sends a copy to the CRM. The page's own form keeps working as before.
(function () {
  var script = document.currentScript;
  if (!script) return;
  var endpoint = script.src.replace(/\/form\.js(\?.*)?$/, '/webhooks/form');
  var key = script.getAttribute('data-key') || '';
  var PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var STORE = 'fcw_crm_tracking';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }

  // Remember ad details from the address the visitor arrived with (kept for 30 days).
  try {
    var q = new URLSearchParams(location.search), found = {}, any = false;
    PARAMS.forEach(function (k) { if (q.get(k)) { found[k] = q.get(k); any = true; } });
    if (any) {
      found.landing_page = location.href;
      found.ts = Date.now();
      localStorage.setItem(STORE, JSON.stringify(found));
    }
  } catch (e) {}

  function tracking() {
    var t = load();
    if (t.ts && Date.now() - t.ts > 30 * 864e5) return {};
    delete t.ts;
    return t;
  }

  function sendToCrm(data) {
    var body = JSON.stringify(data);
    try {
      // text/plain avoids a CORS preflight, so the copy still goes out if the page navigates away.
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
    } catch (e) {}
    try { fetch(endpoint, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }); } catch (e) {}
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM' || form.hasAttribute('data-fcw-ignore')) return;
    var data = {};
    try {
      var labels = {};
      for (var i = 0; i < form.elements.length; i++) {
        var el = form.elements[i], text = el.labels && el.labels[0] ? el.labels[0].textContent : el.placeholder;
        if (el.name && text) labels[el.name] = text.replace(/\s*\*\s*$/, '').trim();
      }
      new FormData(form).forEach(function (v, k) {
        if (typeof v !== 'string' || /pass|card|cvv/i.test(k)) return;
        // Builders like Elementor name fields field_ab12cd; use the visible label instead.
        if (/field_[a-z0-9]+\]?$/i.test(k) && labels[k]) k = labels[k];
        if (!(k in data)) data[k] = v;
      });
    } catch (err) { return; }
    var t = tracking();
    for (var k in t) if (!(k in data)) data[k] = t[k];
    data.page_url = location.href;
    data.form_key = key;
    sendToCrm(data);
  }, true);
})();
