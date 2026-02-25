// ========== handlers/group.js (TO'LIQ YANGILANGAN) ==========
const Group = require("../models/group.model");
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const logger = require("../utils/logger");

// Bot username cache
let cachedBotUsername = null;

async function getBotUsername(bot) {
  if (!cachedBotUsername) {
    const info = await bot.getMe();
    cachedBotUsername = info.username;
  }
  return cachedBotUsername;
}

module.exports = (bot) => {
  // ========== GURUHGA QO'SHILGANDA ==========
  bot.on("new_chat_members", async (msg) => {
    try {
      const botInfo = await bot.getMe();
      const isBotAdded = msg.new_chat_members.some((m) => m.id === botInfo.id);

      if (!isBotAdded) return;

      const existingGroup = await Group.findOne({ groupId: msg.chat.id });

      if (!existingGroup) {
        await Group.create({
          groupId: msg.chat.id,
          title: msg.chat.title,
          type: msg.chat.type,
          addedBy: msg.from.id,
        });
        logger.info(`✅ Yangi guruh qo'shildi: ${msg.chat.title}`);
      }

      const botUsername = await getBotUsername(bot);

      bot.sendMessage(
        msg.chat.id,
        `🚕 Taksi bot guruhga qo'shildi!\n\n` +
          `✅ Bu guruhda buyurtmalar avtomatik ravishda paydo bo'ladi.\n\n` +
          `⚠️ MUHIM:\n` +
          `• Buyurtmalarni qabul qilish uchun avval botga shaxsiy chatda kirish kerak\n` +
          `• Guruhda buyurtma berish mumkin EMAS\n` +
          `• Faqat ro'yxatdan o'tgan haydovchilar buyurtma qabul qilishi mumkin\n\n` +
          `📱 Botga o'tish: @${botUsername}\n`,
      );
    } catch (err) {
      logger.error("Guruhga qo'shilish xatosi:", err);
    }
  });

  // ========== GURUHDA XABARLARNI BLOKLASH ==========
  bot.on("message", async (msg) => {
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") return;
    if (msg.new_chat_members) return;

    if (msg.text && !msg.text.startsWith("/")) {
      try {
        const botUsername = await getBotUsername(bot);

        await bot.sendMessage(
          msg.chat.id,
          `⚠️ Bu guruhda faqat buyurtmalar ko'rinadi.\n\n` +
            `📱 Taksi chaqirish yoki haydovchi bo'lish uchun:\n` +
            `👉 @${botUsername} ga shaxsiy chatda /start bosing`,
          {
            reply_to_message_id: msg.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🚕 Botga o'tish",
                    url: `https://t.me/${botUsername}`,
                  },
                ],
              ],
            },
          },
        );
      } catch (err) {
        logger.error("Guruh message handler error:", err);
      }
    }
  });
};
