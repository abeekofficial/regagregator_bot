const logger = require("../utils/logger");
const { execSync } = require("child_process");
const { version } = require("../package.json");

module.exports = (bot) => {
  const gitVersion = execSync("git rev-parse --short HEAD").toString().trim();
  bot.onText("📋 Bot haqida", async (msg) => {
    const chatId = msg.chat.id;
    let message = `
🤖 Bot versiyasi: ${version}

    🚕 REGAGREGATOR BOT — Tez. Qulay. Ishonchli.

🇺🇿 O‘zbekiston bo‘ylab viloyatlararo taksi va yuk yetkazib berish xizmati.

Yo‘lovchimisiz yoki haydovchimisiz — farqi yo‘q.
Biz sizni bir platformada bog‘laymiz.

👤 Buyurtmachilar uchun

Safar endi oson:

✅ Bir necha soniyada buyurtma berish
✅ Mos haydovchini tez topish
✅ Haydovchi ma’lumotlarini ko‘rish
✅ Safar jarayonini kuzatish
✅ Safardan so‘ng baholash

🔒 Xavfsiz va shaffof tizim
⏱ Tezkor javob
⭐ Sifat nazorati mavjud

🚖 Haydovchilar uchun

Ko‘proq buyurtma. Ko‘proq daromad.

🚗 Yangi buyurtmalarni tez ko‘rish
🌍 Barcha yo‘nalishlar bo‘yicha ishlash imkoniyati
📊 Statistika va reyting tizimi
⭐ Yuqori baho — ko‘proq ishonch
⚡ Adolatli va avtomatik taqsimlash

🔥 Nega aynan REGAGREGATOR?

✔️ Tez ishlaydigan bot
✔️ Buyurtma holatini to‘liq nazorat qilish
✔️ O‘zaro baholash tizimi
✔️ Avtomatik eslatmalar
✔️ Professional xizmat muhiti

📲 Hoziroq foydalanishni boshlang!
🤖 Bot: @regagregator_bot
📞 Admin: @codascript`;

    try {
      await bot.sendMessage(chatId, message);
      logger.info("Bot haqida malumotlar");
    } catch (error) {
      bot.sendMessage(chatId, "Bot malumotlarini yuklashda xatolik");
      logger.warn("Bot malumotlarida xatolik");
    }
  });
};
