# 🎓 Ingliz Tili O'quv Markazi — 42% Grant Sahifasi va Lid Tizimi

Ushbu loyiha ingliz tili o'quv markazi uchun maxsus ishlab chiqilgan bo'lib, o'quvchilarni 42% lik grant aksiyasiga jalb qilish, qizil rangdagi katta orqaga hisoblovchi taymer (16-sentabr 17:42 gacha), jozibador kurslar ma'lumotlari hamda ro'yxatdan o'tgan o'quvchilarni lid sifatida qabul qilish uchun xizmat qiladi.

---

## 🌟 Asosiy Imkoniyatlar

1. **Eng Yuqori Qismdagi Jonli Soat**:
   - Har soniyada yangilanib turuvchi real-vaqt soati va sana.
   - 16-sentabr 17:42 gacha 42% grant e'loni.
2. **Katta Qizil Orqaga Sanash Taymeri (Countdown Timer)**:
   - 16-sentabr soat 17:42 gacha qolgan vaqtni (Kun, Soat, Daqiqa, Sekund) katta, qizil raqamli va pulsatsiyalanuvchi dizaynda ko'rsatadi.
3. **O'quv Markazi va Grant Imtiyozlari**:
   - 42% grant doirasida beriladigan imtiyozlar (bepul kitoblar, Speaking Club, Mock testlar).
   - Kurslar dasturi (General English, IELTS Intensive, Speaking).
   - O'quvchilarning real natijalari va fikrlari.
4. **Ro'yxatdan O'tish Formasi (Lid Capture)**:
   - Ism va familiyani kiritish.
   - Telefon raqami uchun `+998 (XX) XXX-XX-XX` avtomatik maskasi.
   - Ariza yuborilganda konfetti effekti va muvaffaqiyat modali.
5. **Lidlarni Qabul Qilish (Lead Management)**:
   - **Admin Panel (`/admin.html`)**: Barcha lidlarni bir joyda ko'rish, qidirish, statusini o'zgartirish (Yangi, Bog'lanildi, To'lov qildi).
   - **Excel / CSV Yuklab Olish**: Barcha lidlarni 1 tugma orqali Excel jadvaliga eksport qilish.

---

## 🚀 Ishga Tushirish

### 1. Bog'liqliklarni o'rnatish
```bash
cmd /c npm install
```

### 2. Loyihani ishga tushirish
```bash
node server.js
```

Endi brauzerda oching:
- **Asosiy sahifa:** [http://localhost:3000](http://localhost:3000)
- **Admin panel:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
- **Admin parol:** standart parol yo'q. `.env` faylida `ADMIN_PASSWORD=` (kamida 8 belgi) yozing, aks holda admin panel o'chiq turadi.

---

## 🔐 Xavfsizlik

- Parol va kalitlar faqat `.env` faylida (GitHub'ga chiqmaydi) yoki hosting sozlamalarida turadi. Kodga yozilmaydi.
- `.env` namunasi:
  ```env
  ADMIN_PASSWORD=kamida-8-belgili-kuchli-parol
  SESSION_SECRET=uzun-tasodifiy-satr
  ```
- Saytdan kelgan arizalar asosan Status Academy CRM ga (edu.smartivecrm.uz) tushadi.
- Telegram bot 2026-11 da butunlay olib tashlangan.
