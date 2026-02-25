// ========== handlers/profile.js ==========
const User = require("../models/user.model");
const logger = require("../utils/logger");

module.exports = (bot) => {
  bot.onText(/👤 Profilim/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || !user.role) {
        return bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmangansiz!");
      }

      const botInfo = await bot.getMe();
      const referralLink = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

      let profileMsg = `👤 PROFIL\n\n`;
      profileMsg += `📝 Ism: ${user.name || "❌ Kiritilmagan"}\n`;
      profileMsg += `📱 Telefon: ${user.phone || "❌ Kiritilmagan"}\n`;
      profileMsg += `👥 Telegram: @${user.username || "Yo'q"}\n`;
      profileMsg += `🔖 ID: ${user.telegramId}\n`;
      profileMsg += `📅 Sana: ${user.createdAt.toLocaleDateString("uz-UZ")}\n\n`;

      // ✅ HAYDOVCHI MA'LUMOTLARI
      if (user.role === "driver") {
        profileMsg += `🚗 HAYDOVCHI:\n`;
        profileMsg += `🚙 Mashina: ${user.carModel || "❌"}\n`;
        profileMsg += `🔢 Raqam: ${user.carNumber || "❌"}\n`;
        profileMsg += `📍 ${user.from || "?"} → ${user.to || "?"}\n`;
        profileMsg += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n`;
        profileMsg += `📦 Buyurtmalar: ${user.completedOrders || 0}\n\n`;
      }

      // ✅ REFERAL MA'LUMOTLARI
      profileMsg += `🎁 REFERAL:\n`;
      profileMsg += `👥 Taklif qilganlar: ${user.referralCount || 0}\n`;

      profileMsg += `\n📎 Havolangiz:\n${referralLink}`;

      bot.sendMessage(chatId, profileMsg);
    } catch (err) {
      logger.error("Profilim error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};
