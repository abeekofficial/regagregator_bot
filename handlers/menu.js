// ========== handlers/menu.js (YANGILANGAN) ==========
const config = require("../config/environment");
const User = require("../models/user.model");
const logger = require("../utils/logger");

async function showMainMenu(bot, chatId, user) {
  try {
    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;

    if (!user.referralCode) {
      user.referralCode = `REF${user.telegramId}${Date.now().toString(36).toUpperCase()}`;
      await user.save();
    }

    const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

    let message = "";
    let keyboard = [];

    if (user.role === "passenger") {
      message = `👋 Xush kelibsiz${user.name ? `, ${user.name}` : ""}!\n\n`;
      message += `📊 Sizning statistikangiz:\n`;
      message += `👥 Taklif qilganlar: ${user.referralCount || 0} ta\n\n`;
      message += `🎁 Referal havolangiz:\n${referralLink}`;

      keyboard = [
        ["🚖 Buyurtma berish", "📦 Yuk/Pochta"],
        ["👤 Profilim", "📊 Tarixim"],
        ["📋 Bot haqida"],
      ];
    } else if (user.role === "driver") {
      message = `🚗 Xush kelibsiz${user.name ? `, ${user.name}` : ""}!\n\n`;
      message += `📊 Sizning statistikangiz:\n`;
      message += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n`;
      message += `📦 Bajarilgan: ${user.completedOrders || 0} ta\n`;
      message += `👥 Taklif qilganlar: ${user.referralCount || 0} ta\n\n`;

      const priorityLevel = (user.referralCount || 0) > 10 ? "Yuqori" : "O'rta";
      message += `📈 Priority: ${user.referralCount || 0} (${priorityLevel})\n\n`;
      message += `🎁 Referal havolangiz:\n${referralLink}`;

      keyboard = [
        ["🚖 Buyurtma qabul qilishni boshlash"],
        ["📋 Buyurtmalar", "👤 Profilim"],
        ["📊 Statistika", "⭐ Reytingim", "📋 Bot haqida"],
      ];
    } else if (config.ADMIN_IDS.includes(chatId)) {
      message = `👑 ADMIN PANEL\n\nXush kelibsiz!`;
      keyboard = [
        ["📊 Statistika", "👥 Foydalanuvchilar"],
        ["🚫 Bloklangan", "💬 Guruhlar"],
        ["📈 Hisobotlar", "🔧 Sozlamalar"],
      ];
    } else {
      message = `👋 Xush kelibsiz!\n\n`;
      message += `⚠️ Siz hali ro'yxatdan o'tmangansiz.\n`;
      message += `Kim sifatida kirmoqchisiz?`;

      keyboard = [["🚕 Haydovchi", "🧍 Yo'lovchi"]];
    }

    bot.sendMessage(chatId, message, {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
      },
    });
  } catch (err) {
    logger.error("showMainMenu error:", err);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi, /start ni qayta bosing");
  }
}

module.exports = (bot) => {
  // ✅ BOSH MENUGA QAYTISH
  bot.onText(/⬅️ Bosh menuga qaytish/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (user && user.role) {
        return showMainMenu(bot, chatId, user);
      } else {
        bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmangansiz! /start bosing");
      }
    } catch (err) {
      logger.error("Bosh menu error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};

module.exports.showMainMenu = showMainMenu;
