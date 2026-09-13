const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Deadline: 16-sentabr 17:42
const DEADLINE_ISO = process.env.DEADLINE_ISO || '2026-09-16T17:42:00';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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

// Telegram notification function
function sendTelegramNotification(lead) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Bot token yoki Chat ID sozlanmagan. Xabar konsolga chiqarilmoqda:');
    console.log(`[Yangi Lid] Ism: ${lead.name}, Tel: ${lead.phone}, Kurs: ${lead.course || 'Tanlanmagan'}`);
    return;
  }

  const message = `🔥 <b>STATUS ACADEMY — YANGI O'QUVCHI (42% GRANT)!</b>\n\n` +
    `👤 <b>Ismi:</b> ${lead.name}\n` +
    `📞 <b>Telefon:</b> <a href="tel:${lead.phone}">${lead.phone}</a>\n` +
    `📚 <b>Yo'nalish:</b> ${lead.course || 'Umumiy'}\n` +
    `⏰ <b>Vaqt:</b> ${lead.createdAtFormatted}\n` +
    `🆔 <b>Lid ID:</b> #${lead.id}\n\n` +
    `⚡️ <i>Tezda aloqaga chiqing va 42% grantni tasdiqlang! (+998-97-821-30-30)</i>`;

  const payload = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });

  const req = https.request(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    },
    (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[Telegram] Bildirishnoma muvaffaqiyatli yuborildi.');
        } else {
          console.error('[Telegram] Xatolik yuz berdi:', body);
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error('[Telegram] Aloqa xatosi:', err.message);
  });

  req.write(payload);
  req.end();
}

// Public API: Get config (deadline, grant info)
app.get('/api/config', (req, res) => {
  res.json({
    deadline: DEADLINE_ISO,
    discountPercentage: 42,
    telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)
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
    status: 'yangi', // yangi | boglanildi | tolov_qildi | bekor_qilindi
    createdAt: now.toISOString(),
    createdAtFormatted: formattedDate,
    ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1'
  };

  leads.unshift(newLead);
  saveLeads(leads);

  // Send Telegram alert
  sendTelegramNotification(newLead);

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
    new: leads.filter(l => l.status === 'yangi').length,
    contacted: leads.filter(l => l.status === 'boglanildi').length,
    enrolled: leads.filter(l => l.status === 'tolov_qildi').length
  };

  res.json({ success: true, stats });
});

// Start server if run directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 O'quv markazi sayti ishga tushdi: http://localhost:${PORT}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`🔐 Admin standart parol: ${ADMIN_PASSWORD}`);
    console.log(`⏰ 42% Grant yakunlanish vaqti: ${DEADLINE_ISO}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
