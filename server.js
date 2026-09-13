const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { initTelegramBot, broadcastNewLead } = require('./telegram_crm');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const BOT_PASSWORD = process.env.BOT_PASSWORD || 'status777';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8778141953:AAEmTELu0FHT9C9xfGNfWL9kqkKt8ksbMCI';

// Deadline: 16-sentabr 17:42
const DEADLINE_ISO = process.env.DEADLINE_ISO || '2026-09-16T17:42:00';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // Also serve root static files

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

// Telegram CRM botini ishga tushirish
initTelegramBot({
  token: TELEGRAM_BOT_TOKEN,
  password: BOT_PASSWORD,
  dataDir: DATA_DIR,
  getLeads,
  saveLeads
});

// Public API: Get config (deadline, grant info)
app.get('/api/config', (req, res) => {
  res.json({
    deadline: DEADLINE_ISO,
    discountPercentage: 42,
    telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN)
  });
});

// Public API: Register new lead
app.post('/api/register', (req, res) => {
  const { name, phone, course } = req.body;

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
    ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1'
  };

  leads.unshift(newLead);
  saveLeads(leads);

  // Telegram CRM botga yuborish (Inline status tugmalari bilan birga)
  broadcastNewLead(newLead);

  res.status(201).json({
    success: true,
    message: "Tabriklaymiz! Siz 42% grant uchun muvaffaqiyatli ro'yxatdan o'tdingiz. Menejerimiz 10 daqiqa ichida siz bilan bog'lanadi!",
    leadId: newLead.id
  });
});

// Middleware: Admin Auth
function checkAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const customPass = req.headers['x-admin-password'];

  if (token === ADMIN_PASSWORD || customPass === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Admin ruxsati berilmadi. Noto'g'ri parol!" });
}

// Admin API: Verify Password
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: ADMIN_PASSWORD });
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
  const { status, notes } = req.body;
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
    console.log(`🤖 Telegram CRM Bot: @Status_lid_bot faol`);
    console.log(`⏰ 42% Grant yakunlanish vaqti: ${DEADLINE_ISO}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
