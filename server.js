const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
// Sirlar faqat muhit o'zgaruvchilaridan (.env yoki hosting sozlamalari) olinadi.
// Kodda standart parol yoki token YO'Q: berilmasa tegishli qism o'chiq turadi.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
// Admin sessiya tokenini imzolash uchun kalit (berilmasa paroldan hosil qilinadi)
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim() || (ADMIN_PASSWORD ? crypto.createHash('sha256').update('status-session:' + ADMIN_PASSWORD).digest('hex') : '');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 soat

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.warn('[XAVFSIZLIK] ADMIN_PASSWORD berilmagan yoki 8 belgidan qisqa — web admin panel o\'chiq.');
}

// Deadline: 16-sentabr 17:42
const DEADLINE_ISO = process.env.DEADLINE_ISO || '2026-09-16T17:42:00';

app.disable('x-powered-by');
app.set('trust proxy', 1);
// Admin API boshqa saytlardan chaqirilmasin: CORS faqat ochiq endpointlar uchun
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));

// Faqat sayt fayllari ochiq. Loyiha papkasining o'zi (data/leads.json, server.js, .env ...) ochilmaydi.
const PUBLIC_FILES = ['index.html', 'admin.html'];
PUBLIC_FILES.forEach((f) => app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, f))));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
['css', 'js', 'images'].forEach((d) => app.use('/' + d, express.static(path.join(__dirname, d), { dotfiles: 'deny' })));
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));

const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// Ensure data folder and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2), 'utf8');
}

function getLeads() {
  try {
    const raw = fs.readFileSync(LEADS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Error reading leads.json:', err);
    return [];
  }
}

function saveLeads(leads) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving leads.json:', err);
    return false;
  }
}


// Oddiy so'rov cheklagich (IP bo'yicha, xotirada)
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." });
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signSession(expires) {
  return crypto.createHmac('sha256', SESSION_SECRET).update('admin:' + expires).digest('hex');
}
function makeAdminToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  return expires + '.' + signSession(expires);
}
function verifyAdminToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  const expires = Number(exp);
  if (!expires || !sig || expires < Date.now()) return false;
  return safeEqual(sig, signSession(expires));
}

const VALID_STATUSES = ['yangi', 'oylab', 'javob', 'oquvchi', 'rad'];

// Public API: Get config (deadline, grant info)
app.get('/api/config', cors(), (req, res) => {
  res.json({
    deadline: DEADLINE_ISO,
    discountPercentage: 42
  });
});

// Public API: Register new lead
app.options('/api/register', cors());
app.post('/api/register', cors(), rateLimit(5, 10 * 60 * 1000), (req, res) => {
  const { name, phone, course } = req.body || {};
  if (typeof name !== 'string' || typeof phone !== 'string' || (course != null && typeof course !== 'string')) {
    return res.status(400).json({ error: "Ma'lumot noto'g'ri" });
  }
  if (name.length > 100 || phone.length > 30 || (course || '').length > 100) {
    return res.status(400).json({ error: "Ma'lumot juda uzun" });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Iltimos, ism va familiyangizni to'liq kiriting!" });
  }

  // Basic phone verification: digits count should be at least 9
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) {
    return res.status(400).json({ error: "Iltimos, to'g'ri telefon raqam kiriting!" });
  }

  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tashkent'
  }).format(now);

  const leads = getLeads();
  const newLead = {
    id: 'LID-' + Date.now().toString().slice(-6),
    name: name.trim(),
    phone: phone.trim(),
    course: (course || 'General English').trim(),
    status: 'yangi', // yangi | oylab | javob | oquvchi | rad
    createdAt: now.toISOString(),
    createdAtFormatted: formattedDate,
    ip: req.ip || ''
  };

  leads.unshift(newLead);
  saveLeads(leads);


  res.status(201).json({
    success: true,
    message: "Tabriklaymiz! Siz 42% grant uchun muvaffaqiyatli ro'yxatdan o'tdingiz. Menejerimiz 10 daqiqa ichida siz bilan bog'lanadi!",
    leadId: newLead.id
  });
});

// Middleware: Admin Auth — web panel imzolangan tokeni (12 soat amal qiladi)
function checkAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token && verifyAdminToken(token)) return next();

  return res.status(401).json({ error: "Admin ruxsati berilmadi. Qayta kiring." });
}

// Admin API: Verify Password
app.post('/api/admin/login', rateLimit(5, 15 * 60 * 1000), (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    return res.status(503).json({ error: "Admin panel sozlanmagan (ADMIN_PASSWORD yo'q)." });
  }
  if (password && safeEqual(password, ADMIN_PASSWORD)) {
    return res.json({ success: true, token: makeAdminToken() });
  }
  return res.status(401).json({ error: "Noto'g'ri parol!" });
});

// Admin API: Get all leads
app.get('/api/leads', checkAdminAuth, (req, res) => {
  const leads = getLeads();
  res.json({ success: true, leads });
});

// Admin API: Update lead status
app.patch('/api/leads/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body || {};
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Noto'g'ri holat" });
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) {
    return res.status(400).json({ error: "Izoh noto'g'ri" });
  }
  const leads = getLeads();
  const leadIndex = leads.findIndex(l => l.id === id);

  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lid topilmadi' });
  }

  if (status) leads[leadIndex].status = status;
  if (notes !== undefined) leads[leadIndex].notes = notes;
  leads[leadIndex].updatedAt = new Date().toISOString();

  saveLeads(leads);
  res.json({ success: true, lead: leads[leadIndex] });
});

// Admin API: Delete lead
app.delete('/api/leads/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  let leads = getLeads();
  const initialLength = leads.length;
  leads = leads.filter(l => l.id !== id);

  if (leads.length === initialLength) {
    return res.status(404).json({ error: 'Lid topilmadi' });
  }

  saveLeads(leads);
  res.json({ success: true, message: "Lid o'chirildi" });
});

// Admin API: Get Statistics
app.get('/api/stats', checkAdminAuth, (req, res) => {
  const leads = getLeads();
  const todayStr = new Date().toISOString().slice(0, 10);

  const stats = {
    total: leads.length,
    today: leads.filter(l => (l.createdAt || '').slice(0, 10) === todayStr).length,
    new: leads.filter(l => !l.status || l.status === 'yangi').length,
    contacted: leads.filter(l => l.status === 'oylab' || l.status === 'javob').length,
    enrolled: leads.filter(l => l.status === 'oquvchi').length,
    rejected: leads.filter(l => l.status === 'rad').length
  };

  res.json({ success: true, stats });
});

// Start server if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 STATUS ACADEMY sayti ishga tushdi: http://localhost:${PORT}`);
    console.log(`📊 Web Admin panel: http://localhost:${PORT}/admin.html`);
      console.log(`⏰ 42% Grant yakunlanish vaqti: ${DEADLINE_ISO}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
