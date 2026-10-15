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
  googleAdsKey: process.env.GOOGLE_ADS_KEY || 'fcw-google-key',
  // Password for opening the CRM (username can be anything). Webhooks stay open so WhatsApp and Google can reach them.
  appPassword: process.env.APP_PASSWORD || '',
};

const STATUSES = ['New', 'Contacted', 'Interested', 'Follow-up', 'Proposal sent', 'Won', 'Lost'];
const SOURCES = ['WhatsApp', 'Google Ads', 'Referral', 'Walk-in', 'Other'];

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
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
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
  if (!p.startsWith('/webhooks/') && !authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FCW CRM", charset="UTF-8"' });
    return res.end('Password required');
  }

  if (p === '/api/meta' && req.method === 'GET') {
    return send(res, 200, {
      statuses: STATUSES,
      sources: SOURCES,
      liveSending: config.waSend && !!config.waToken && !!config.waPhoneNumberId,
      ownerPhoneSet: !!config.ownerPhone,
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

  if (p === '/api/outbox' && req.method === 'GET') return send(res, 200, db.outbox.slice(0, 300));

  // ---- WhatsApp Cloud API webhook: new chats become leads ----
  if (p === '/webhooks/whatsapp' && req.method === 'GET') {
    const ok = url.searchParams.get('hub.verify_token') === config.waVerifyToken;
    return ok ? send(res, 200, url.searchParams.get('hub.challenge') || '', 'text/plain') : send(res, 403, { error: 'Bad token' });
  }
  if (p === '/webhooks/whatsapp' && req.method === 'POST') {
    const body = await readBody(req);
    let created = 0;
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
        for (const msg of v.messages || []) {
          const text = msg.text?.body || `[${msg.type} message]`;
          let lead = findByPhone(msg.from);
          if (!lead) {
            lead = createLead({ name: names[msg.from], phone: msg.from, source: 'WhatsApp' }, 'from an incoming WhatsApp message');
            created++;
          }
          log(lead, 'inbound', `WhatsApp: "${text}"`);
        }
      }
    }
    save();
    return send(res, 200, { ok: true, created });
  }

  // ---- Google Ads lead form webhook ----
  if (p === '/webhooks/google-ads' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.google_key !== config.googleAdsKey) return send(res, 403, { error: 'Bad key' });
    const col = (idName) => (body.user_column_data || []).find((c) => c.column_id === idName)?.string_value || '';
    const input = {
      name: col('FULL_NAME') || [col('FIRST_NAME'), col('LAST_NAME')].filter(Boolean).join(' '),
      phone: col('PHONE_NUMBER'),
      email: col('EMAIL'),
      source: 'Google Ads',
      campaign: String(body.campaign_id || ''),
      notes: body.is_test ? 'Google Ads test lead' : '',
    };
    const existing = findByPhone(input.phone);
    if (existing) log(existing, 'inbound', `Submitted a Google Ads lead form again (campaign ${input.campaign})`);
    else createLead(input, 'from a Google Ads lead form');
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
