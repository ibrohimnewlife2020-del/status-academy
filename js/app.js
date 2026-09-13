document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initCountdown();
  initPhoneMask();
  initRegistrationForm();
});

// 1. Jonli vaqt va sana (Real-time Clock)
function initLiveClock() {
  const clockElement = document.getElementById('liveClock');
  if (!clockElement) return;

  const monthsUz = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
  ];

  const daysUz = [
    'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'
  ];

  function updateClock() {
    const now = new Date();
    const dayName = daysUz[now.getDay()];
    const day = now.getDate();
    const monthName = monthsUz[now.getMonth()];
    const year = now.getFullYear();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    clockElement.innerHTML = `
      <span class="inline-flex items-center gap-1.5 font-medium text-emerald-400">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        Jonli vaqt:
      </span>
      <span class="text-white font-semibold">${dayName}, ${day}-${monthName} ${year}-yil</span>
      <span class="bg-gray-800 text-yellow-400 px-2 py-0.5 rounded font-mono font-bold tracking-wider">${hours}:${minutes}:${seconds}</span>
    `;
  }

  updateClock();
  setInterval(updateClock, 1000);
}

// 2. Katta qizil orqaga sanash taymeri (16-sentabr 17:42 gacha)
let targetDeadline = new Date('2026-09-16T17:42:00').getTime();

async function initCountdown() {
  // Configdan deadline olish
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.deadline) {
        targetDeadline = new Date(data.deadline).getTime();
      }
    }
  } catch (err) {
    console.warn('Config yuklashda xatolik, standart deadline ishlatiladi:', err);
  }

  const daysEl = document.getElementById('timerDays');
  const hoursEl = document.getElementById('timerHours');
  const minutesEl = document.getElementById('timerMinutes');
  const secondsEl = document.getElementById('timerSeconds');
  const urgentNoticeEl = document.getElementById('urgentCountdownText');

  function updateTimer() {
    const now = new Date().getTime();
    const diff = targetDeadline - now;

    if (diff <= 0) {
      if (daysEl) daysEl.innerText = '00';
      if (hoursEl) hoursEl.innerText = '00';
      if (minutesEl) minutesEl.innerText = '00';
      if (secondsEl) secondsEl.innerText = '00';
      if (urgentNoticeEl) {
        urgentNoticeEl.innerHTML = '<span class="text-yellow-400 font-bold">⚠️ Asosiy muddat yakunlandi, lekin zaxira o\'rinlar uchun ariza topshirishingiz mumkin!</span>';
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (daysEl) daysEl.innerText = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.innerText = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.innerText = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.innerText = String(seconds).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// 3. O'zbekiston telefon raqami maskasi (+998 (XX) XXX-XX-XX)
function initPhoneMask() {
  const phoneInput = document.getElementById('studentPhone');
  if (!phoneInput) return;

  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value.startsWith('+998')) {
      phoneInput.value = '+998 ';
    }
  });

  phoneInput.addEventListener('input', (e) => {
    let input = e.target.value.replace(/\D/g, ''); // faqat raqamlar
    if (!input.startsWith('998')) {
      input = '998' + input;
    }
    input = input.substring(0, 12); // 998 + 9 xona

    let formatted = '+998';
    if (input.length > 3) {
      formatted += ' (' + input.substring(3, 5);
    }
    if (input.length >= 5) {
      formatted += ') ' + input.substring(5, 8);
    }
    if (input.length >= 8) {
      formatted += '-' + input.substring(8, 10);
    }
    if (input.length >= 10) {
      formatted += '-' + input.substring(10, 12);
    }

    e.target.value = formatted;
  });
}

// 4. Ro'yxatdan o'tish formasi (Lead Capture AJAX)
function initRegistrationForm() {
  const form = document.getElementById('leadForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const formError = document.getElementById('formError');
  const successModal = document.getElementById('successModal');
  const modalLeadId = document.getElementById('modalLeadId');
  const modalStudentName = document.getElementById('modalStudentName');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.add('hidden');
    formError.innerText = '';

    const nameInput = document.getElementById('studentName');
    const phoneInput = document.getElementById('studentPhone');
    const courseInput = document.getElementById('studentCourse');

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const course = courseInput ? courseInput.value : 'General English';

    if (name.length < 2) {
      showError("Iltimos, ism va familiyangizni to'liq kiriting!");
      nameInput.focus();
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 12) {
      showError("Iltimos, to'liq telefon raqamingizni kiriting (+998 __ ___-__-__)");
      phoneInput.focus();
      return;
    }

    // Loading holati
    submitBtn.disabled = true;
    btnText.innerText = "Yuborilmoqda...";
    btnSpinner.classList.remove('hidden');

    try {
      let leadId = 'LID-' + Date.now().toString().slice(-6);
      let success = false;
      let errorMsg = '';

      // 1. Avval Node.js server orqali yuborishga urinib ko'rish
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, course })
        });
        if (response.ok) {
          const data = await response.json();
          leadId = data.leadId || leadId;
          success = true;
        } else {
          const data = await response.json().catch(() => ({}));
          errorMsg = data.error || '';
        }
      } catch (serverErr) {
        // Server mavjud emas (statik xostingda)
      }

      // 2. Agar server bo'lmasa, to'g'ridan-to'g'ri Telegram Bot orqali yuborish (100% bepul serversiz)
      if (!success && window.TELEGRAM_CONFIG && window.TELEGRAM_CONFIG.BOT_TOKEN && window.TELEGRAM_CONFIG.CHAT_ID) {
        try {
          const nowStr = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
          const tgMsg = `🔥 <b>STATUS ACADEMY — YANGI O'QUVCHI (42% GRANT)!</b>\n\n` +
            `👤 <b>Ismi:</b> ${name}\n` +
            `📞 <b>Telefon:</b> <a href="tel:${phone}">${phone}</a>\n` +
            `📚 <b>Kurs:</b> ${course}\n` +
            `⏰ <b>Vaqt:</b> ${nowStr}\n` +
            `🆔 <b>Lid ID:</b> #${leadId}\n\n` +
            `⚡️ <i>Tezda aloqaga chiqing va 42% grantni tasdiqlang! (+998-97-821-30-30)</i>`;

          const tgRes = await fetch(`https://api.telegram.org/bot${window.TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: window.TELEGRAM_CONFIG.CHAT_ID,
              text: tgMsg,
              parse_mode: 'HTML'
            })
          });

          if (tgRes.ok) {
            success = true;
          }
        } catch (tgErr) {
          console.error('Telegramga yuborishda xatolik:', tgErr);
        }
      }

      // 3. Mahalliy brauzer xotirasiga ham nusxa saqlash (zaxira)
      try {
        const localLeads = JSON.parse(localStorage.getItem('status_academy_leads') || '[]');
        localLeads.unshift({ id: leadId, name, phone, course, date: new Date().toISOString() });
        localStorage.setItem('status_academy_leads', JSON.stringify(localLeads));
      } catch (storageErr) {}

      if (!success && errorMsg) {
        throw new Error(errorMsg);
      }

      // Muvaffaqiyatli yuborildi!
      form.reset();
      phoneInput.value = '+998 ';

      // Modal ko'rsatish
      if (modalStudentName) modalStudentName.innerText = name;
      if (modalLeadId) modalLeadId.innerText = leadId;
      if (successModal) successModal.classList.remove('hidden');

      // Konfetti otish
      launchConfetti();

    } catch (err) {
      showError(err.message || 'Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
    } finally {
      submitBtn.disabled = false;
      btnText.innerText = "🔥 42% GRANTNI BAND QILISH";
      btnSpinner.classList.add('hidden');
    }
  });

  function showError(msg) {
    if (formError) {
      formError.innerText = msg;
      formError.classList.remove('hidden');
    } else {
      alert(msg);
    }
  }
}

// Modalni yopish funksiyasi
window.closeModal = function() {
  const successModal = document.getElementById('successModal');
  if (successModal) {
    successModal.classList.add('hidden');
  }
};

// Konfetti animatsiyasi
function launchConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ffffff']
    });

    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
}
