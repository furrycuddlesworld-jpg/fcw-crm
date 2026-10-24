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

  // Submissions wait in this browser until the CRM confirms them, so a brief CRM restart loses nothing.
  var QUEUE = 'fcw_crm_pending';
  function pending() { try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch (e) { return []; } }
  function setPending(list) { try { localStorage.setItem(QUEUE, JSON.stringify(list.slice(-20))); } catch (e) {} }

  function post(body) {
    return fetch(endpoint, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
      .then(function (r) { return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429); });
  }

  // One send at a time, so several clicks never post the same form twice.
  var busy = false;
  function flush(attempt) {
    if (busy) return;
    var list = pending();
    if (!list.length || !window.fetch) return;
    var body = list[0];
    busy = true;
    post(body).then(function (done) {
      busy = false;
      if (!done) throw new Error('retry');
      setPending(pending().filter(function (b) { return b !== body; }));
      flush(0);
    }).catch(function () {
      busy = false;
      if (attempt < 6) setTimeout(function () { flush(attempt + 1); }, [5, 10, 20, 40, 60, 120][attempt] * 1000);
    });
  }

  function sendToCrm(data) {
    var body = JSON.stringify(data);
    if (!window.fetch) {
      try { navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' })); } catch (e) {}
      return;
    }
    if (pending().indexOf(body) === -1) setPending(pending().concat([body]));
    flush(0);
  }

  // Anything left over from an earlier visit goes now.
  flush(0);

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

    // Elementor checks the form on its server first. Only copy it to the CRM once Elementor says
    // it was accepted, so the CRM gets exactly what your form (and Google Sheet) gets.
    if (/\belementor-form\b/.test(form.className) && window.jQuery) {
      form.__fcwData = data;
      if (!form.__fcwBound) {
        form.__fcwBound = true;
        var onSuccess = function () {
          if (form.__fcwData) { sendToCrm(form.__fcwData); form.__fcwData = null; }
        };
        window.jQuery(form).on('submit_success', onSuccess);
        form.addEventListener('submit_success', onSuccess);
      }
      return;
    }
    sendToCrm(data);
  }, true);
})();
