// FCW CRM: a small, dependency-free lead tracker.
// Run with `node server.js`, then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = {
  port: Number(process.env.PORT || 3000),
  dataFile: process.env.DATA_FILE || path.join(__dirname, 'data.json'),
  // Where reminders to you go. Must differ from the business number: WhatsApp cannot message itself.
  ownerPhone: process.env.OWNER_PHONE || '',
  // WhatsApp Business (Cloud API). Nothing is sent unless WHATSAPP_SEND=on and both values are set.
  waSend: process.env.WHATSAPP_SEND === 'on',
  waToken: process.env.WHATSAPP_TOKEN || '',
  waPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  waVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'fcw-verify',
  // Meta app secret: when set, incoming WhatsApp webhooks must carry a valid signature.
  waAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  // For partners (like 360dialog) that forward WhatsApp webhooks without Meta's signature:
  // give them the webhook URL ending in ?key=<this value>.
  waWebhookKey: process.env.WHATSAPP_WEBHOOK_KEY || '',
  // 360dialog API key for your number; lets the CRM point 360dialog's webhook at itself.
  d360ApiKey: process.env.D360_API_KEY || '',
  // Secret key entered in Interakt's Developer Settings with the webhook URL.
  interaktSecret: process.env.INTERAKT_SECRET || '',
  publicUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '',
  googleAdsKey: process.env.GOOGLE_ADS_KEY || 'fcw-google-key',
  // Optional key the landing page sends with each form (a spam filter, not a secret: it's visible in the page).
  formKey: process.env.FORM_KEY || '',
  // Where a plain HTML form is sent after submitting, e.g. your thank-you page.
  formThanksUrl: process.env.FORM_THANKS_URL || '',
  // Friendly names for Google Ads campaign IDs, e.g. "21234567890=Diwali Sale; 21234567891=Kids Gifts".
  googleCampaignNames: Object.fromEntries((process.env.GOOGLE_CAMPAIGN_NAMES || '').split(/[;,\n]/)
    .map((pair) => pair.split(/[=:]/).map((x) => x.trim())).filter(([k, v]) => k && v)),
  // Password for opening the CRM (username can be anything). Webhooks stay open so WhatsApp and Google can reach them.
  appPassword: process.env.APP_PASSWORD || '',
  // New leads from WhatsApp or ads get a "reply or call" reminder this many minutes later. 0 turns it off.
  newLeadFollowUpMinutes: Number(process.env.NEW_LEAD_FOLLOWUP_MINUTES ?? 60),
};

const STATUSES = ['New', 'Contacted', 'Interested', 'Follow-up', 'Proposal sent', 'Won', 'Lost'];
const SOURCES = ['WhatsApp', 'Meta Ads', 'Google Ads', 'Website', 'Referral', 'Walk-in', 'Other'];

// ---------- storage ----------
function load() {
  try { return JSON.parse(fs.readFileSync(config.dataFile, 'utf8')); }
  catch { return { leads: [], outbox: [] }; }
}
let db = load();
function save() {
  const tmp = config.dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, config.dataFile);
}

const id = () => crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();
const digits = (p) => String(p || '').replace(/\D/g, '');

function log(lead, type, text) {
  lead.history.unshift({ at: now(), type, text });
  lead.updatedAt = now();
}

function findByPhone(phone) {
  const d = digits(phone);
  return d ? db.leads.find((l) => digits(l.phone) === d) : null;
}

function createLead(input, how) {
  const lead = {
    id: id(),
    name: (input.name || '').trim() || 'Unknown',
    phone: digits(input.phone),
    email: (input.email || '').trim(),
    source: SOURCES.includes(input.source) ? input.source : 'Other',
    referredBy: (input.referredBy || '').trim(),
    campaign: (input.campaign || '').trim(),
    adId: input.adId || '',
    googleLeadId: input.googleLeadId || '',
    gclid: input.gclid || '',
    adUrl: input.adUrl || '',
    ctwaClid: input.ctwaClid || '',
    interest: (input.interest || '').trim(),
    status: STATUSES.includes(input.status) ? input.status : 'New',
    createdAt: now(),
    updatedAt: now(),
    history: [],
    followUps: [],
  };
  log(lead, 'created', `Lead added ${how}${lead.source === 'Referral' && lead.referredBy ? `, referred by ${lead.referredBy}` : ''}`);
  if (input.notes) log(lead, 'note', input.notes.trim());
  db.leads.unshift(lead);
  return lead;
}

// First step of the journey: remind the owner to answer a fresh lead quickly.
function addFirstFollowUp(lead) {
  if (!(config.newLeadFollowUpMinutes > 0)) return;
  const due = new Date(Date.now() + config.newLeadFollowUpMinutes * 60000);
  lead.followUps.push({
    id: id(), dueAt: due.toISOString(), action: 'call', note: 'New lead: reply or call',
    clientMessage: '', createdAt: now(), firedAt: null, done: false,
  });
  log(lead, 'scheduled', `First follow-up set for ${due.toISOString()}`);
}

// Which Meta ad a WhatsApp chat came from. Click-to-WhatsApp ads attach a "referral" to the first
// message; as a backup, an ad's pre-filled message can carry a code like "(Ad: DIWALI)".
function adFromMessage(msg) {
  const r = msg.referral;
  if (r && (r.source_type === 'ad' || r.source_id)) {
    return { campaign: r.headline || r.source_id || 'Meta ad', adId: r.source_id || '', adUrl: r.source_url || '', ctwaClid: r.ctwa_clid || '' };
  }
  const code = (msg.text?.body || '').match(/\(\s*ad\s*[:\-]\s*([^)]+)\)/i);
  return code ? { campaign: code[1].trim() } : null;
}

// An incoming WhatsApp message, from Meta directly or a partner. Returns true when it made a new lead.
function recordInbound(phone, name, text, ad) {
  let lead = findByPhone(phone);
  let isNew = false;
  if (!lead) {
    lead = ad
      ? createLead({ name, phone, source: 'Meta Ads', ...ad }, `from a Meta ad on WhatsApp ("${ad.campaign}")`)
      : createLead({ name, phone, source: 'WhatsApp' }, 'from an incoming WhatsApp message');
    addFirstFollowUp(lead);
    isNew = true;
  } else if (ad) {
    log(lead, 'inbound', `Came back through Meta ad "${ad.campaign}"`);
  }
  log(lead, 'inbound', `WhatsApp: "${text}"`);
  return isNew;
}

// ---------- landing page forms ----------
// Form builders name fields differently; flatten the payload and match common names.
function flattenForm(body) {
  const out = {};
  const put = (k, v) => {
    if (v == null || typeof v === 'object') return;
    // Bracketed names like fields[phone][value] or form_fields[email] use the inner name.
    const inner = String(k).match(/\[([^[\]]+)\](?:\[(?:value|raw_value)\])?$/);
    if (inner && !/^(value|raw_value)$/.test(inner[1])) k = inner[1];
    const key = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key && !(key in out)) out[key] = { label: String(k), value: String(v).trim() };
  };
  const walk = (obj, depth) => {
    if (Array.isArray(obj)) {
      for (const item of obj) if (item && typeof item === 'object') {
        const k = item.name ?? item.label ?? item.title ?? item.key ?? item.id;
        if (k != null && 'value' in item) put(k, Array.isArray(item.value) ? item.value.join(', ') : item.value);
        else if (depth < 3) walk(item, depth + 1);
      }
      return;
    }
    for (const [k, v] of Object.entries(obj || {})) {
      if (v && typeof v === 'object') { if (depth < 3) walk(v, depth + 1); } else put(k, v);
    }
  };
  walk(body, 0);
  return out;
}

const FORM_FIELDS = {
  name: ['name', 'fullname', 'yourname', 'customername', 'contactname'],
  firstName: ['firstname', 'fname'],
  lastName: ['lastname', 'lname', 'surname'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'whatsapp', 'whatsappnumber', 'contactnumber', 'yourphone', 'number', 'contact'],
  email: ['email', 'emailaddress', 'youremail', 'mail'],
  tracking: ['gclid', 'gbraid', 'wbraid', 'fbclid', 'utmsource', 'utmmedium', 'utmcampaign', 'utmcontent', 'utmterm', 'pageurl', 'landingpage', 'formkey', 'fcwhp', 'redirect', 'ts'],
};

const formHits = new Map();
function formRateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const t = Date.now(), recent = (formHits.get(ip) || []).filter((x) => t - x < 10 * 60000);
  recent.push(t);
  formHits.set(ip, recent);
  return recent.length > 10;
}

function leadFromForm(body, referer) {
  const f = flattenForm(body);
  const get = (names) => names.map((n) => f[n]?.value).find(Boolean) || '';
  // Ad details can come as fields, or inside the page address the form was on.
  const params = new URLSearchParams();
  for (const u of [get(['landingpage']), get(['pageurl']), referer]) {
    try { for (const [k, v] of new URL(u).searchParams) if (!params.has(k)) params.set(k, v); } catch {}
  }
  const tr = (k) => get([k.replace(/_/g, '')]) || params.get(k) || '';
  const utmSource = tr('utm_source').toLowerCase();
  const gclid = tr('gclid') || tr('gbraid') || tr('wbraid');
  const fbclid = tr('fbclid');
  const source = gclid || /google|adwords/.test(utmSource) ? 'Google Ads'
    : fbclid || /facebook|^fb$|instagram|^ig$|meta/.test(utmSource) ? 'Meta Ads' : 'Website';
  let campaign = tr('utm_campaign');
  if (source === 'Google Ads' && config.googleCampaignNames[campaign]) campaign = config.googleCampaignNames[campaign];
  const used = new Set([...FORM_FIELDS.name, ...FORM_FIELDS.firstName, ...FORM_FIELDS.lastName, ...FORM_FIELDS.phone, ...FORM_FIELDS.email, ...FORM_FIELDS.tracking]);
  const answers = Object.entries(f).filter(([k, v]) => !used.has(k) && v.value && !/pass|card|cvv|token|nonce|captcha|recaptcha/.test(k))
    .map(([, v]) => `${v.label}: ${v.value.slice(0, 500)}`);
  return {
    name: get(FORM_FIELDS.name) || [get(FORM_FIELDS.firstName), get(FORM_FIELDS.lastName)].filter(Boolean).join(' '),
    phone: get(FORM_FIELDS.phone),
    email: get(FORM_FIELDS.email),
    source,
    campaign: campaign || (source === 'Website' && utmSource ? utmSource : ''),
    gclid,
    adId: tr('utm_content'),
    notes: answers.length ? 'Form answers: ' + answers.join('; ') : '',
    page: get(['pageurl']) || get(['landingpage']) || referer || '',
    honeypot: get(['fcwhp']),
    key: get(['formkey']),
    redirect: get(['redirect']),
  };
}

// ---------- WhatsApp sending ----------
async function sendWhatsApp(to, text) {
  if (!config.waSend || !config.waToken || !config.waPhoneNumberId) {
    return { status: 'test', detail: 'Test mode: not sent' };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${config.waPhoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: digits(to), type: 'text', text: { body: text } }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { status: 'sent', detail: 'Sent' } : { status: 'failed', detail: body.error?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { status: 'failed', detail: e.message };
  }
}

async function queueMessage(kind, lead, to, text) {
  const msg = { id: id(), at: now(), kind, leadId: lead.id, leadName: lead.name, to: digits(to), text };
  if (!msg.to) Object.assign(msg, { status: 'failed', detail: kind === 'reminder' ? 'OWNER_PHONE is not set' : 'Lead has no phone number' });
  else Object.assign(msg, await sendWhatsApp(msg.to, text));
  db.outbox.unshift(msg);
  return msg;
}

// ---------- reminder engine ----------
// Each follow-up fires once when due: a reminder to you, and (if chosen) a follow-up text to the client.
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const t = Date.now();
    let changed = false;
    for (const lead of db.leads) {
      for (const f of lead.followUps) {
        if (f.firedAt || f.done || new Date(f.dueAt).getTime() > t) continue;
        f.firedAt = now();
        changed = true;
        const what = f.action === 'call' ? 'Call' : 'Follow up with';
        const ownerText = `Reminder: ${what} ${lead.name} (+${lead.phone || 'no number'}). Status: ${lead.status}.${f.note ? ' Note: ' + f.note : ''}`;
        await queueMessage('reminder', lead, config.ownerPhone, ownerText);
        if (f.clientMessage) {
          const m = await queueMessage('client', lead, lead.phone, f.clientMessage);
          log(lead, 'message', `Follow-up text to client (${m.detail}): "${f.clientMessage}"`);
        }
        log(lead, 'reminder', `Reminder fired: ${what.toLowerCase()} ${lead.name}`);
      }
    }
    if (changed) save();
  } finally {
    ticking = false;
  }
}
setInterval(tick, 30_000);

// ---------- HTTP helpers ----------
function send(res, code, data, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      req.rawBody = raw;
      if (/x-www-form-urlencoded/.test(req.headers['content-type'] || '')) return resolve(Object.fromEntries(new URLSearchParams(raw)));
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}
// Meta signs each webhook with the app secret (X-Hub-Signature-256: sha256=<hex>).
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// A WhatsApp webhook is accepted when it carries Meta's signature or the partner key.
// With neither configured, the endpoint stays open (local testing only).
function whatsappWebhookAllowed(req, url) {
  if (!config.waAppSecret && !config.waWebhookKey) return true;
  if (config.waAppSecret && req.headers['x-hub-signature-256'] && validMetaSignature(req)) return true;
  return !!config.waWebhookKey && safeEqual(url.searchParams.get('key') || '', config.waWebhookKey);
}

function validMetaSignature(req) {
  if (!config.waAppSecret) return true;
  const given = Buffer.from(String(req.headers['x-hub-signature-256'] || ''));
  const want = Buffer.from('sha256=' + crypto.createHmac('sha256', config.waAppSecret).update(req.rawBody || '').digest('hex'));
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function authorized(req) {
  if (!config.appPassword) return true;
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const given = Buffer.from(Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':'));
  const want = Buffer.from(config.appPassword);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = (re) => p.match(re);
  let r;

  if (p === '/healthz') return send(res, 200, { ok: true });
  if (!p.startsWith('/webhooks/') && p !== '/form.js' && !authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FCW CRM", charset="UTF-8"' });
    return res.end('Password required');
  }

  if (p === '/api/meta' && req.method === 'GET') {
    return send(res, 200, {
      statuses: STATUSES,
      sources: SOURCES,
      liveSending: config.waSend && !!config.waToken && !!config.waPhoneNumberId,
      ownerPhoneSet: !!config.ownerPhone,
      d360Ready: !!(config.d360ApiKey && config.waWebhookKey && config.publicUrl),
    });
  }

  if (p === '/api/leads' && req.method === 'GET') return send(res, 200, db.leads);

  if (p === '/api/leads' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.phone && findByPhone(body.phone)) return send(res, 409, { error: 'A lead with this phone number already exists' });
    const lead = createLead(body, 'manually');
    save();
    return send(res, 201, lead);
  }

  if ((r = m(/^\/api\/leads\/(\w+)$/))) {
    const lead = db.leads.find((l) => l.id === r[1]);
    if (!lead) return send(res, 404, { error: 'Not found' });
    if (req.method === 'GET') return send(res, 200, lead);
    if (req.method === 'DELETE') {
      db.leads = db.leads.filter((l) => l !== lead);
      save();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      if (body.status && body.status !== lead.status && STATUSES.includes(body.status)) {
        log(lead, 'status', `Status changed from ${lead.status} to ${body.status}`);
        lead.status = body.status;
      }
      for (const k of ['name', 'email', 'referredBy', 'campaign', 'interest']) if (k in body) lead[k] = String(body[k]).trim();
      if ('phone' in body) lead.phone = digits(body.phone);
      if (body.source && SOURCES.includes(body.source)) lead.source = body.source;
      lead.updatedAt = now();
      save();
      return send(res, 200, lead);
    }
  }

  if ((r = m(/^\/api\/leads\/(\w+)\/notes$/)) && req.method === 'POST') {
    const lead = db.leads.find((l) => l.id === r[1]);
    if (!lead) return send(res, 404, { error: 'Not found' });
    const body = await readBody(req);
    if (!body.text?.trim()) return send(res, 400, { error: 'Note is empty' });
    log(lead, body.type === 'call' ? 'call' : 'note', body.text.trim());
    save();
    return send(res, 200, lead);
  }

  if ((r = m(/^\/api\/leads\/(\w+)\/followups$/)) && req.method === 'POST') {
    const lead = db.leads.find((l) => l.id === r[1]);
    if (!lead) return send(res, 404, { error: 'Not found' });
    const body = await readBody(req);
    const due = new Date(body.dueAt);
    if (isNaN(due)) return send(res, 400, { error: 'Pick a date and time' });
    const f = {
      id: id(),
      dueAt: due.toISOString(),
      action: body.action === 'call' ? 'call' : 'followup',
      note: (body.note || '').trim(),
      clientMessage: (body.clientMessage || '').trim(),
      createdAt: now(),
      firedAt: null,
      done: false,
    };
    lead.followUps.push(f);
    log(lead, 'scheduled', `${f.action === 'call' ? 'Call' : 'Follow-up'} scheduled for ${due.toISOString()}${f.clientMessage ? ' with a text to the client' : ''}`);
    if (lead.status === 'New') {
      log(lead, 'status', 'Status changed from New to Follow-up');
      lead.status = 'Follow-up';
    }
    save();
    tick();
    return send(res, 201, lead);
  }

  if ((r = m(/^\/api\/leads\/(\w+)\/followups\/(\w+)$/))) {
    const lead = db.leads.find((l) => l.id === r[1]);
    const f = lead?.followUps.find((x) => x.id === r[2]);
    if (!f) return send(res, 404, { error: 'Not found' });
    if (req.method === 'DELETE') {
      lead.followUps = lead.followUps.filter((x) => x !== f);
      log(lead, 'scheduled', 'Follow-up cancelled');
    } else if (req.method === 'PATCH') {
      const body = await readBody(req);
      if (body.done && !f.done) { f.done = true; f.doneAt = now(); log(lead, 'done', `Follow-up marked done${body.outcome ? ': ' + body.outcome : ''}`); }
      if (body.snoozeMinutes) {
        f.dueAt = new Date(Date.now() + Number(body.snoozeMinutes) * 60000).toISOString();
        f.firedAt = null;
        log(lead, 'scheduled', `Follow-up snoozed to ${f.dueAt}`);
      }
    }
    save();
    return send(res, 200, lead);
  }

  // Tell 360dialog to deliver this number's WhatsApp messages to the CRM.
  if (p === '/api/whatsapp/connect-360dialog' && req.method === 'POST') {
    if (!config.d360ApiKey) return send(res, 400, { error: 'Add D360_API_KEY in Render first' });
    if (!config.waWebhookKey || !config.publicUrl) return send(res, 400, { error: 'WHATSAPP_WEBHOOK_KEY or the app address is missing' });
    const hook = `${config.publicUrl.replace(/\/$/, '')}/webhooks/whatsapp?key=${encodeURIComponent(config.waWebhookKey)}`;
    try {
      const r2 = await fetch('https://waba-v2.360dialog.io/v1/configs/webhook', {
        method: 'POST',
        headers: { 'D360-API-KEY': config.d360ApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: hook }),
      });
      const out = await r2.json().catch(() => ({}));
      if (!r2.ok) return send(res, 502, { error: `360dialog said: ${out.meta?.developer_message || out.error?.message || 'HTTP ' + r2.status}` });
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 502, { error: `Could not reach 360dialog: ${e.message}` });
    }
  }

  if (p === '/api/outbox' && req.method === 'GET') return send(res, 200, db.outbox.slice(0, 300));

  // ---- WhatsApp Cloud API webhook: new chats become leads ----
  if (p === '/webhooks/whatsapp' && req.method === 'GET') {
    const ok = url.searchParams.get('hub.verify_token') === config.waVerifyToken;
    return ok ? send(res, 200, url.searchParams.get('hub.challenge') || '', 'text/plain') : send(res, 403, { error: 'Bad token' });
  }
  if (p === '/webhooks/whatsapp' && req.method === 'POST') {
    const body = await readBody(req);
    if (!whatsappWebhookAllowed(req, url)) return send(res, 401, { error: 'Bad signature' });
    let created = 0;
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
        // Messages you send from the WhatsApp Business app (coexistence) arrive as echoes.
        for (const echo of v.message_echoes || []) {
          const lead = findByPhone(echo.to);
          if (!lead) continue;
          log(lead, 'outbound', `You (WhatsApp app): "${echo.text?.body || `[${echo.type} message]`}"`);
          if (lead.status === 'New') {
            log(lead, 'status', 'Status changed from New to Contacted (you replied on WhatsApp)');
            lead.status = 'Contacted';
          }
        }
        for (const msg of v.messages || []) {
          const text = msg.text?.body || `[${msg.type} message]`;
          if (recordInbound(msg.from, names[msg.from], text, adFromMessage(msg))) created++;
        }
      }
    }
    save();
    return send(res, 200, { ok: true, created });
  }

  // ---- Interakt webhook (customer messages), signed with Interakt-Signature ----
  if (p === '/webhooks/interakt' && req.method === 'POST') {
    const body = await readBody(req);
    if (!config.interaktSecret) return send(res, 403, { error: 'INTERAKT_SECRET is not set' });
    const want = 'sha256=' + crypto.createHmac('sha256', config.interaktSecret).update(req.rawBody || '').digest('hex');
    if (!safeEqual(req.headers['interakt-signature'] || '', want)) return send(res, 401, { error: 'Bad signature' });
    const c = body.data?.customer || {}, m = body.data?.message || {};
    let created = 0;
    if (body.type === 'message_received' && m.chat_message_type === 'CustomerMessage' && c.channel_phone_number) {
      const text = typeof m.message === 'string' && m.message ? m.message : `[${m.message_content_type || 'media'} message]`;
      const ad = adFromMessage({ text: { body: text } });
      if (recordInbound(c.channel_phone_number, c.traits?.name, text, ad)) created++;
      save();
    }
    return send(res, 200, { ok: true, created });
  }

  // ---- Landing page form (any website form builder, or the /form.js snippet) ----
  if (p === '/webhooks/form') {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    const reply = (code, data) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const body = await readBody(req);
    const lead = leadFromForm(body, req.headers.referer || '');
    if (config.formKey && !safeEqual(lead.key || url.searchParams.get('key') || '', config.formKey)) return reply(403, { error: 'Bad form key' });
    if (lead.honeypot) return reply(200, { ok: true }); // a bot filled the hidden field
    if (formRateLimited(req)) return reply(429, { error: 'Too many submissions, try again later' });
    if (!lead.phone && !lead.email) return reply(400, { error: 'A phone number or email is needed' });
    const existing = lead.phone ? findByPhone(lead.phone) : db.leads.find((l) => l.email && l.email.toLowerCase() === lead.email.toLowerCase());
    const where = `${lead.source === 'Website' ? 'the website form' : `a ${lead.source} landing page`}${lead.campaign ? ` ("${lead.campaign}")` : ''}`;
    if (existing) {
      log(existing, 'inbound', `Filled ${where} again${lead.notes ? '. ' + lead.notes : ''}`);
      existing.followUps.some((x) => !x.done) || addFirstFollowUp(existing);
    } else {
      const created = createLead(lead, `from ${where}`);
      if (lead.page) log(created, 'inbound', `Page: ${lead.page.slice(0, 300)}`);
      addFirstFollowUp(created);
    }
    save();
    const thanks = lead.redirect || config.formThanksUrl;
    // Only a browser posting a plain HTML form is sent on to the thank-you page; webhooks get JSON.
    if (thanks && /text\/html/.test(req.headers.accept || '') && /^https?:\/\//.test(thanks)) {
      res.writeHead(303, { Location: thanks });
      return res.end();
    }
    return reply(200, { ok: true });
  }

  // ---- Google Ads lead form webhook ----
  if (p === '/webhooks/google-ads' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.google_key !== config.googleAdsKey) return send(res, 403, { error: 'Bad key' });
    const cols = body.user_column_data || [];
    const col = (idName) => cols.find((c) => c.column_id === idName)?.string_value || '';
    // Google retries deliveries; the same lead_id is only recorded once.
    if (body.lead_id && db.leads.some((l) => l.googleLeadId === String(body.lead_id))) return send(res, 200, { ok: true, duplicate: true });
    const campaignId = String(body.campaign_id || '');
    const campaign = config.googleCampaignNames[campaignId] || (campaignId ? `Google campaign ${campaignId}` : 'Google lead form');
    const known = new Set(['FULL_NAME', 'FIRST_NAME', 'LAST_NAME', 'PHONE_NUMBER', 'EMAIL']);
    const answers = cols.filter((c) => !known.has(c.column_id) && c.string_value)
      .map((c) => `${c.column_name || c.column_id.replace(/_/g, ' ').toLowerCase()}: ${c.string_value}`);
    const input = {
      name: col('FULL_NAME') || [col('FIRST_NAME'), col('LAST_NAME')].filter(Boolean).join(' '),
      phone: col('PHONE_NUMBER'),
      email: col('EMAIL'),
      source: 'Google Ads',
      campaign,
      googleLeadId: String(body.lead_id || ''),
      gclid: body.gcl_id || '',
      notes: [body.is_test ? 'Google Ads test lead' : '', answers.length ? 'Form answers: ' + answers.join('; ') : ''].filter(Boolean).join('. '),
    };
    const existing = findByPhone(input.phone);
    if (existing) {
      log(existing, 'inbound', `Submitted a Google Ads lead form again ("${campaign}")${answers.length ? '. ' + answers.join('; ') : ''}`);
      existing.followUps.some((f) => !f.done) || addFirstFollowUp(existing);
    } else addFirstFollowUp(createLead(input, `from a Google Ads lead form ("${campaign}")`));
    save();
    return send(res, 200, { ok: true });
  }

  // ---- static files ----
  if (req.method === 'GET') {
    const file = path.join(__dirname, 'public', p === '/' ? 'index.html' : path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (file.startsWith(path.join(__dirname, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    }
  }
  send(res, 404, { error: 'Not found' });
}

http.createServer((req, res) => handle(req, res).catch((e) => send(res, 500, { error: e.message })))
  .listen(config.port, () => {
    console.log(`FCW CRM running at http://localhost:${config.port}`);
    console.log(config.waSend ? 'WhatsApp sending is ON' : 'Test mode: WhatsApp messages are logged, not sent');
    if (!config.appPassword) console.log('Warning: APP_PASSWORD is not set, so anyone with the link can open the CRM');
    tick();
  });
