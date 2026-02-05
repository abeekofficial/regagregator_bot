# 📝 O'rnatish qo'llanmasi

Bu qo'llanma sizga Telegram Taksi botini bosqichma-bosqich o'rnatishda yordam beradi.

## 🔧 1-qadam: Tizim talablari

Quyidagilarni o'rnating:
- **Node.js** (v14 yoki yuqori): https://nodejs.org/
- **Git** (ixtiyoriy): https://git-scm.com/

Tekshirish:
```bash
node --version  # v14.0.0 yoki yuqori bo'lishi kerak
npm --version   # 6.0.0 yoki yuqori bo'lishi kerak
```

## 🤖 2-qadam: Telegram Bot yaratish

1. Telegram'da @BotFather botini toping
2. `/newbot` komandasini yuboring
3. Bot nomini kiriting (masalan: "Mening Taksi Botim")
4. Bot username kiriting (masalan: "my_taxi_bot")
5. BotFather sizga **token** beradi. Uni saqlang!

Misol token:
```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

## 👤 3-qadam: Telegram ID ni olish

1. @userinfobot botini toping
2. Unga `/start` yuboring
3. Sizning **User ID** ni ko'rsatadi (masalan: 123456789)

## 💾 4-qadam: Loyihani yuklab olish

```bash
# Git orqali
git clone https://github.com/yourusername/taxi-bot.git
cd taxi-bot

# Yoki ZIP faylni yuklab olib, ochib oling
cd taxi-bot-main
```

## 📦 5-qadam: Bog'liqliklarni o'rnatish

```bash
npm install
```

Bu 1-2 daqiqa davom etishi mumkin.

## ⚙️ 6-qadam: .env faylini sozlash

1. `.env.example` faylini `.env` ga nusxalang:

**Windows:**
```cmd
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

2. `.env` faylini matn muharririda oching

3. Quyidagi qiymatlarni kiriting:

```env
# Bot tokeni (@BotFather dan)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Sizning Telegram ID (admin bo'lasiz)
ADMIN_IDS=123456789

# Qolganini o'zgartirmasangiz ham bo'ladi
DB_PATH=./database/taxi.db
ORDER_TIMEOUT=5000
MAX_DRIVERS_PER_ORDER=10
REFERRAL_BONUS=1000
MIN_REFERRALS_FOR_PRIORITY=5
```

**Muhim:**
- `BOT_TOKEN` - BotFather'dan olgan tokeningiz
- `ADMIN_IDS` - Sizning Telegram ID raqamingiz

Bir nechta admin bo'lishi uchun vergul bilan ajrating:
```env
ADMIN_IDS=123456789,987654321,555666777
```

## 🧪 7-qadam: Testdan o'tkazish

```bash
npm run test
```

Natija:
```
🧪 Testing bot configuration...

1️⃣ Checking environment variables:
   ✅ BOT_TOKEN: Set
   ✅ ADMIN_IDS: Set

2️⃣ Checking Node.js version:
   ✅ Node.js v18.0.0 (OK)

3️⃣ Checking dependencies:
   ✅ node-telegram-bot-api: Installed
   ✅ sqlite3: Installed
   ✅ dotenv: Installed

4️⃣ Testing Telegram Bot API connection:
   ✅ Bot connected: @my_taxi_bot
   📝 Bot name: Mening Taksi Botim

✅ All tests passed!

🚀 You can now start the bot with: npm start
```

## 🚀 8-qadam: Botni ishga tushirish

### Development (test) rejimida:
```bash
npm run dev
```

### Production rejimida:
```bash
npm start
```

Muvaffaqiyatli ishga tushganda:
```
🚀 Bot ishga tushdi...
📅 Sana: 05.02.2026, 10:30:00
🤖 Bot username: To'g'ri
✅ Telegram Taksi Bot ishga tushdi!
```

## 📱 9-qadam: Botni sinab ko'rish

1. Telegram'da botingizni toping (@my_taxi_bot)
2. `/start` ni bosing
3. Ma'lumotlarni to'ldiring
4. Bot ishlayotganini tekshiring

## 🛑 Botni to'xtatish

`Ctrl + C` tugmalarini bosing

## ❓ Muammolar va yechimlar

### Muammo: "Error: 401 Unauthorized"
**Yechim:** BOT_TOKEN noto'g'ri. .env faylini tekshiring.

### Muammo: "Cannot find module 'node-telegram-bot-api'"
**Yechim:** Dependencies o'rnatilmagan. `npm install` buyrug'ini bajaring.

### Muammo: "EADDRINUSE" xatosi
**Yechim:** Bot allaqachon ishlab turibdi. Botni to'xtatib, qaytadan ishga tushiring.

### Muammo: Database xatosi
**Yechim:** 
```bash
# Database faylini o'chirish
rm -rf database/

# Qaytadan ishga tushirish
npm start
```

## 🔄 Yangilash

Loyihani yangilash:
```bash
git pull origin main
npm install
npm start
```

## 📞 Yordam

Muammoga duch kelsangiz:
1. README.md faylini o'qing
2. GitHub Issues bo'limida qidiring
3. Yangi issue oching

## ✅ Keyingi qadamlar

Bot muvaffaqiyatli ishga tushgandan keyin:

1. **Yo'lovchi sifatida sinab ko'ring:**
   - Botga /start yuboring
   - Ma'lumotlarni to'ldiring
   - Yo'lovchi sifatida taksi chaqiring

2. **Haydovchi sifatida sinab ko'ring:**
   - Yangi Telegram akkaunt yarating
   - Botga /start yuboring
   - Haydovchi sifatida ro'yxatdan o'ting
   - Mashina ma'lumotlarini kiriting

3. **Admin panel:**
   - Botga /start yuboring
   - Admin panelini ko'ring
   - Statistikani tekshiring

## 🎉 Tabriklaymiz!

Sizning Telegram Taksi botingiz tayyor! 🚖

---

**Omad tilaklar! 🚀**
