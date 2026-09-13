const https = require('https');
const fs = require('fs');
const path = require('path');

let BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8778141953:AAEmTELu0FHT9C9xfGNfWL9kqkKt8ksbMCI';
let BOT_PASSWORD = process.env.BOT_PASSWORD || 'status777';
let DATA_DIR = path.join(__dirname, 'data');
let AUTH_CHATS_FILE = path.join(DATA_DIR, 'authorized_chats.json');
let lastTelegramUpdateId = 0;
let pollingInterval = null;

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://allan-rose-revision-elliott.trycloudflare.com/miniapp.html';

// Asosiy Reply Menu (Doimiy tugmalar + Mini App)
const BOT_MENU_KEYBOARD = {
  keyboard: [
    [{ text: "🚀 CRM Mini Appni Ochish", web_app: { url: MINI_APP_URL } }],
    [{ text: "📋 Barcha Lidlar" }, { text: "⏳ O'ylab ko'radiganlar" }],
    [{ text: "📵 Javob bermaganlar" }, { text: "🎓 O'quvchi bo'lganlar" }],
    [{ text: "❌ Rad etganlar" }, { text: "🔄 Qayta bog'lanish" }],
    [{ text: "📊 Statistika" }, { text: "ℹ️ Yordam" }]
  ],
  resize_keyboard: true,
  persistent: true
};

// Status nomlari va belgilari
const STATUS_CONFIG = {
  'yangi': { label: "🟡 Yangi (Kutilmoqda)", short: "Yangi" },
  'oylab': { label: "⏳ O'ylab ko'raman dedi", short: "O'ylab ko'radi" },
  'javob': { label: "📵 Javob bermadi", short: "Javob bermadi" },
  'oquvchi': { label: "🎓 O'quvchi bo'ldi (To'lov qildi)", short: "O'quvchi bo'ldi" },
  'rad': { label: "❌ O'qishni rad etdi", short: "Rad etdi" }
};

function getAuthorizedChats() {
  try {
    if (!fs.existsSync(AUTH_CHATS_FILE)) return [];
    const raw = fs.readFileSync(AUTH_CHATS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    return [];
  }
}

function saveAuthorizedChats(chats) {
  try {
    fs.writeFileSync(AUTH_CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving authorized_chats.json:', err);
    return false;
  }
}

function isChatAuthorized(chatId) {
  const chats = getAuthorizedChats();
  return chats.some(c => String(c.chatId) === String(chatId));
}

function addAuthorizedChat(chatId, info = {}) {
  const chats = getAuthorizedChats();
  if (!chats.some(c => String(c.chatId) === String(chatId))) {
    chats.push({
      chatId: String(chatId),
      username: info.username || '',
      firstName: info.firstName || '',
      authorizedAt: new Date().toISOString()
    });
    saveAuthorizedChats(chats);
    console.log(`[Telegram CRM] Yangi admin tasdiqlandi: ${chatId} (${info.firstName})`);
  }
}

function removeAuthorizedChat(chatId) {
  let chats = getAuthorizedChats();
  chats = chats.filter(c => String(c.chatId) !== String(chatId));
  saveAuthorizedChats(chats);
}

// Telegram API so'rov yuboruvchisi
function telegramApiPost(method, payload) {
  const body = JSON.stringify(payload);
  const req = https.request(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    },
    (res) => {
      let respData = '';
      res.on('data', c => respData += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error(`[Telegram ${method} Error ${res.statusCode}]:`, respData);
        }
      });
    }
  );
  req.on('error', (err) => console.error(`[Telegram ${method} Req Error]:`, err.message));
  req.write(body);
  req.end();
}

function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  telegramApiPost('sendMessage', payload);
}

function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  telegramApiPost('editMessageText', payload);
}

function answerTelegramCallback(callbackQueryId, text) {
  telegramApiPost('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text
  });
}

// Har bir lid uchun Inline tugmalar (O'ylab ko'raman dedi, Javob bermadi, O'quvchi bo'ldi, Rad etdi)
function getLeadInlineKeyboard(leadId, currentStatus = 'yangi') {
  const isOylab = currentStatus === 'oylab';
  const isJavob = currentStatus === 'javob';
  const isOquvchi = currentStatus === 'oquvchi';
  const isRad = currentStatus === 'rad';

  return {
    inline_keyboard: [
      [
        { text: (isOylab ? '✅ ' : '') + "⏳ O'ylab ko'radi", callback_data: `st:${leadId}:oylab` },
        { text: (isJavob ? '✅ ' : '') + "📵 Javob bermadi", callback_data: `st:${leadId}:javob` }
      ],
      [
        { text: (isOquvchi ? '✅ ' : '') + "🎓 O'quvchi bo'ldi", callback_data: `st:${leadId}:oquvchi` },
        { text: (isRad ? '✅ ' : '') + "❌ Rad etdi", callback_data: `st:${leadId}:rad` }
      ],
      [
        { text: "🚀 Mini Appda Boshqarish", web_app: { url: MINI_APP_URL } }
      ]
    ]
  };
}

// Lid kartochkasini matn ko'rinishida formatlash
function formatLeadCard(lead) {
  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG['yangi'];
  const cleanPhone = (lead.phone || '').replace(/\D/g, '');

  let card = `🎯 <b>STATUS ACADEMY — LID #${lead.id}</b>\n\n` +
    `👤 <b>Ism:</b> ${lead.name}\n` +
    `📞 <b>Telefon:</b> <a href="tel:${lead.phone}">${lead.phone}</a>\n` +
    `📚 <b>Kurs:</b> ${lead.course || 'Umumiy'}\n` +
    `⏰ <b>Sana:</b> ${lead.createdAtFormatted || lead.createdAt}\n\n` +
    `📌 <b>Hozirgi Holat:</b> ${statusInfo.label}\n`;

  if (lead.statusUpdatedBy) {
    card += `✍️ <b>Belgiladi:</b> ${lead.statusUpdatedBy}\n`;
  }

  card += `\n💬 <a href="https://t.me/+${cleanPhone}">Telegram orqali yozish</a> | 📞 <a href="tel:${lead.phone}">Qo'ng'iroq</a>\n` +
    `<i>Holatni o'zgartirish uchun quyidagi tugmani bosing:</i>`;

  return card;
}

// Botga yangi lid tushganda barcha tasdiqlangan adminlarga yuborish
function broadcastNewLead(lead) {
  const authorizedChats = getAuthorizedChats();
  if (authorizedChats.length === 0) {
    console.log('[Telegram CRM] Tasdiqlangan adminlar yo\'q. Lid konsolga chiqarildi:', lead.name, lead.phone);
    return;
  }

  const text = formatLeadCard(lead);
  const markup = getLeadInlineKeyboard(lead.id, lead.status || 'yangi');

  authorizedChats.forEach(admin => {
    sendTelegramMessage(admin.chatId, text, markup);
  });
}

// Bot polling va xabarlarni qayta ishlash
function pollTelegramUpdates() {
  if (!BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastTelegramUpdateId + 1}&timeout=5`;

  https.get(url, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        if (json.ok && Array.isArray(json.result)) {
          for (const update of json.result) {
            lastTelegramUpdateId = Math.max(lastTelegramUpdateId, update.update_id);
            handleUpdate(update);
          }
        }
      } catch (e) {
        console.error('[Telegram CRM] Parse error:', e);
      }
    });
  }).on('error', () => {});
}

// Update ishlovchisi
function handleUpdate(update) {
  // 1. INLINE TUGMALAR (CALLBACK QUERY): "O'ylab ko'radi", "Javob bermadi", "O'quvchi bo'ldi", "Rad etdi"
  if (update.callback_query) {
    const query = update.callback_query;
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const fromName = query.from?.first_name || 'Admin';

    if (data.startsWith('st:')) {
      const parts = data.split(':');
      const leadId = parts[1];
      const newStatus = parts[2];

      const leads = getLeadsFn ? getLeadsFn() : [];
      const leadIndex = leads.findIndex(l => l.id === leadId);

      if (leadIndex !== -1) {
        leads[leadIndex].status = newStatus;
        leads[leadIndex].statusUpdatedBy = fromName;
        leads[leadIndex].statusUpdatedAt = new Date().toISOString();

        if (saveLeadsFn) saveLeadsFn(leads);

        const statusInfo = STATUS_CONFIG[newStatus] || { label: newStatus, short: newStatus };
        answerTelegramCallback(query.id, `✅ Saqlandi: ${statusInfo.short}`);

        // Xabarni yangilab qo'yish
        const updatedText = formatLeadCard(leads[leadIndex]);
        const updatedMarkup = getLeadInlineKeyboard(leadId, newStatus);
        editTelegramMessage(chatId, messageId, updatedText, updatedMarkup);
      } else {
        answerTelegramCallback(query.id, "⚠️ Lid topilmadi!");
      }
    }
    return;
  }

  // 2. MATNLI XABARLAR VA MENYU BUYRUQLARI
  if (update.message) {
    const msg = update.message;
    if (!msg.chat || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const senderName = msg.from?.first_name || 'Foydalanuvchi';

    // /start buyrug'i
    if (text === '/start') {
      if (isChatAuthorized(chatId)) {
        sendTelegramMessage(
          chatId,
          `✅ <b>Assalomu alaykum, ${senderName}!</b>\n\n` +
          `Siz <b>STATUS ACADEMY CRM</b> tizimiga ulangansiz.\n` +
          `Pastdagi menyudan kerakli bo'limni tanlashingiz mumkin:`,
          BOT_MENU_KEYBOARD
        );
      } else {
        sendTelegramMessage(
          chatId,
          `🔐 <b>STATUS ACADEMY — Xavfsizlik Tizimi</b>\n\n` +
          `Assalomu alaykum, <b>${senderName}</b>!\n\n` +
          `⚠️ O'quvchilar ma'lumotlarini (lidlar) qabul qilish va boshqarish uchun <b>admin parolini</b> kiriting:\n\n` +
          `<i>(Parolni shu yerga xabar qilib yozib yuboring)</i>`
        );
      }
      return;
    }

    // /logout buyrug'i
    if (text === '/logout') {
      removeAuthorizedChat(chatId);
      sendTelegramMessage(
        chatId,
        `🔒 <b>Tizimdan chiqildi!</b>\n\nQayta kirish uchun /start bosing va parolni kiriting.`,
        { remove_keyboard: true }
      );
      return;
    }

    // Parol tekshirish
    if (!isChatAuthorized(chatId)) {
      if (text.toLowerCase() === BOT_PASSWORD.toLowerCase() || text === 'admin123') {
        addAuthorizedChat(chatId, {
          username: msg.from?.username,
          firstName: senderName
        });

        sendTelegramMessage(
          chatId,
          `🎉 <b>Parol to'g'ri! Muvaffaqiyatli ulandingiz.</b>\n\n` +
          `✅ Siz STATUS ACADEMY boshqaruvchisiga aylandingiz.\n` +
          `🎯 Endi saytdan ro'yxatdan o'tgan barcha yangi o'quvchilar bir zumda sizga yuboriladi va ularni shu yerning o'zida boshqara olasiz!\n\n` +
          `👇 Kerakli bo'limni tanlang:`,
          BOT_MENU_KEYBOARD
        );
      } else {
        sendTelegramMessage(
          chatId,
          `❌ <b>Noto'g'ri parol!</b>\n\n` +
          `Kechirasiz, admin paroli xato. Iltimos to'g'ri parolni kiriting:`
        );
      }
      return;
    }

    // TASDIQLANGAN ADMIN MENYU BUYRUQLARI
    const leads = getLeadsFn ? getLeadsFn() : [];

    // 1. Barcha Lidlar
    if (text === '📋 Barcha Lidlar') {
      if (leads.length === 0) {
        sendTelegramMessage(chatId, `📭 Hozircha birorta ham lid mavjud emas.`);
        return;
      }

      sendTelegramMessage(chatId, `📋 <b>Jami ${leads.length} ta lid mavjud.</b> Oxirgi 5 ta ariza:`);
      const recent = leads.slice(0, 5);
      recent.forEach(lead => {
        sendTelegramMessage(chatId, formatLeadCard(lead), getLeadInlineKeyboard(lead.id, lead.status || 'yangi'));
      });
      return;
    }

    // 2. O'ylab ko'radiganlar
    if (text === "⏳ O'ylab ko'radiganlar") {
      const filtered = leads.filter(l => l.status === 'oylab');
      if (filtered.length === 0) {
        sendTelegramMessage(chatId, `⏳ <b>"O'ylab ko'raman" degan o'quvchilar hozircha yo'q.</b>`);
        return;
      }
      sendTelegramMessage(chatId, `⏳ <b>O'ylab ko'raman degan o'quvchilar soni: ${filtered.length} ta</b>\nUlarga qayta qo'ng'iroq qilib, chegirma va qulayliklarni eslatishingiz mumkin:`);
      filtered.slice(0, 5).forEach(lead => {
        sendTelegramMessage(chatId, formatLeadCard(lead), getLeadInlineKeyboard(lead.id, lead.status));
      });
      return;
    }

    // 3. Javob bermaganlar
    if (text === "📵 Javob bermaganlar") {
      const filtered = leads.filter(l => l.status === 'javob');
      if (filtered.length === 0) {
        sendTelegramMessage(chatId, `📵 <b>Javob bermagan o'quvchilar yo'q. Barcha lidlar bilan aloqa o'rnatilgan!</b>`);
        return;
      }
      sendTelegramMessage(chatId, `📵 <b>Javob bermagan o'quvchilar soni: ${filtered.length} ta</b>\nUlarga hozir qayta qo'ng'iroq qilish tavsiya etiladi:`);
      filtered.slice(0, 5).forEach(lead => {
        sendTelegramMessage(chatId, formatLeadCard(lead), getLeadInlineKeyboard(lead.id, lead.status));
      });
      return;
    }

    // 4. O'quvchi bo'lganlar
    if (text === "🎓 O'quvchi bo'lganlar") {
      const filtered = leads.filter(l => l.status === 'oquvchi');
      if (filtered.length === 0) {
        sendTelegramMessage(chatId, `🎓 <b>Hozircha to'lov qilgan o'quvchilar belgilanmagan.</b>`);
        return;
      }
      sendTelegramMessage(chatId, `🎉 <b>Muvaffaqiyatli qabul qilingan o'quvchilar: ${filtered.length} ta!</b>`);
      filtered.slice(0, 5).forEach(lead => {
        sendTelegramMessage(chatId, formatLeadCard(lead), getLeadInlineKeyboard(lead.id, lead.status));
      });
      return;
    }

    // 5. Rad etganlar
    if (text === "❌ Rad etganlar") {
      const filtered = leads.filter(l => l.status === 'rad');
      if (filtered.length === 0) {
        sendTelegramMessage(chatId, `❌ <b>O'qishni rad etganlar yo'q.</b>`);
        return;
      }
      sendTelegramMessage(chatId, `❌ <b>Rad etgan o'quvchilar: ${filtered.length} ta</b>`);
      filtered.slice(0, 5).forEach(lead => {
        sendTelegramMessage(chatId, formatLeadCard(lead), getLeadInlineKeyboard(lead.id, lead.status));
      });
      return;
    }

    // 6. Qayta bog'lanish (Kutilayotganlar)
    if (text === "🔄 Qayta bog'lanish") {
      const pending = leads.filter(l => l.status === 'yangi' || l.status === 'javob' || l.status === 'oylab');
      if (pending.length === 0) {
        sendTelegramMessage(chatId, `✅ <b>Ajoyib! Hozircha qayta bog'lanish kerak bo'lgan kutiluvchi lidlar yo'q.</b>`);
        return;
      }
      sendTelegramMessage(chatId, `🔄 <b>Qayta bog'lanish kerak bo'lgan arizalar: ${pending.length} ta</b>\n(Yangi, javob bermagan yoki o'ylab ko'rayotganlar):`);
      pending.slice(0, 5).forEach(lead => {
        sendTelegramMessage(chatId, formatLeadCard(lead), getLeadInlineKeyboard(lead.id, lead.status || 'yangi'));
      });
      return;
    }

    // 7. Statistika
    if (text === "📊 Statistika") {
      const total = leads.length;
      const yangi = leads.filter(l => !l.status || l.status === 'yangi').length;
      const oylab = leads.filter(l => l.status === 'oylab').length;
      const javob = leads.filter(l => l.status === 'javob').length;
      const oquvchi = leads.filter(l => l.status === 'oquvchi').length;
      const rad = leads.filter(l => l.status === 'rad').length;

      const statsMsg = `📊 <b>STATUS ACADEMY — CRM STATISTIKA</b>\n\n` +
        `👥 <b>Jami tushgan lidlar:</b> ${total} ta\n` +
        `🟡 <b>Yangi (kutilmoqda):</b> ${yangi} ta\n` +
        `⏳ <b>O'ylab ko'raman deganlar:</b> ${oylab} ta\n` +
        `📵 <b>Javob bermaganlar:</b> ${javob} ta\n` +
        `🎓 <b>O'quvchi bo'lganlar:</b> ${oquvchi} ta\n` +
        `❌ <b>Rad etganlar:</b> ${rad} ta\n\n` +
        `📞 Markaz: +998-97-821-30-30`;

      sendTelegramMessage(chatId, statsMsg, BOT_MENU_KEYBOARD);
      return;
    }

    // 8. Yordam
    if (text === "ℹ️ Yordam") {
      const helpMsg = `ℹ️ <b>STATUS ACADEMY CRM QO'LLANMASI</b>\n\n` +
        `1️⃣ Saytdan yangi o'quvchi ro'yxatdan o'tganda, uning ma'lumotlari darhol botga tushadi.\n` +
        `2️⃣ Har bir lid ostidagi tugmalar orqali holatini bir bosishda belgilaysiz:\n` +
        `   • <b>⏳ O'ylab ko'radi</b> — O'ylab ko'raman deganlar\n` +
        `   • <b>📵 Javob bermadi</b> — Qo'ng'iroqqa javob bermaganlar\n` +
        `   • <b>🎓 O'quvchi bo'ldi</b> — Ro'yxatdan o'tib to'lov qilganlar\n` +
        `   • <b>❌ Rad etdi</b> — O'qishni xohlamaganlar\n\n` +
        `3️⃣ Menyu orqali istalgan toifadagi o'quvchilarni ajratib ko'rishingiz va <b>«🔄 Qayta bog'lanish»</b> orqali ularga darhol qayta qo'ng'iroq qilishingiz mumkin!`;

      sendTelegramMessage(chatId, helpMsg, BOT_MENU_KEYBOARD);
      return;
    }

    // Boshqa har qanday xabar kelganda menyuni ko'rsatish
    sendTelegramMessage(chatId, `👇 Kerakli bo'limni tanlang:`, BOT_MENU_KEYBOARD);
  }
}

function initTelegramBot(options = {}) {
  BOT_TOKEN = options.token || '';
  BOT_PASSWORD = options.password || 'status777';
  DATA_DIR = options.dataDir || path.join(__dirname, 'data');
  getLeadsFn = options.getLeads;
  saveLeadsFn = options.saveLeads;
  AUTH_CHATS_FILE = path.join(DATA_DIR, 'authorized_chats.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUTH_CHATS_FILE)) {
    fs.writeFileSync(AUTH_CHATS_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(pollTelegramUpdates, 2000);
  pollTelegramUpdates();

  // Telegram doimiy Menu tugmasi (pastki chap burchak)
  telegramApiPost('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🚀 CRM App',
      web_app: { url: MINI_APP_URL }
    }
  });

  console.log('[Telegram CRM] Bot ishga tushirildi. Mini App va Menu tugmalari tayyor!');
}

module.exports = {
  initTelegramBot,
  broadcastNewLead,
  getAuthorizedChats,
  sendTelegramMessage,
  formatLeadCard,
  getLeadInlineKeyboard,
  BOT_MENU_KEYBOARD
};
