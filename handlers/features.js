// ========== handlers/features.js ==========
const features = require("../config/features");
const { isSuperAdmin } = require("../utils/isAdmin");
const logger = require("../utils/logger");

module.exports = (bot) => {
  // ✅ FEATURES RO'YXATI
  bot.onText(/\/features/, async (msg) => {
    const chatId = msg.chat.id;

    if (!isSuperAdmin(chatId)) {
      return bot.sendMessage(chatId, "❌ Sizga ruxsat yo'q!");
    }

    try {
      const featureList = Object.entries(features.list())
        .map(([name, enabled]) => `${enabled ? "✅" : "❌"} ${name}`)
        .join("\n");

      bot.sendMessage(
        chatId,
        `🔧 FEATURES:\n\n${featureList}\n\n/feature_on NAME\n/feature_off NAME`,
      );
    } catch (err) {
      logger.error("Features list error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ✅ FEATURE YOQISH
  bot.onText(/\/feature_on (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!isSuperAdmin(chatId)) {
      return bot.sendMessage(chatId, "❌ Sizga ruxsat yo'q!");
    }

    try {
      const featureName = match[1];
      features.toggle(featureName, true);

      logger.info(`Feature yoqildi: ${featureName}`, chatId);
      bot.sendMessage(chatId, `✅ ${featureName} yoqildi`);
    } catch (err) {
      logger.error("Feature ON error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ✅ FEATURE O'CHIRISH
  bot.onText(/\/feature_off (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!isSuperAdmin(chatId)) {
      return bot.sendMessage(chatId, "❌ Sizga ruxsat yo'q!");
    }

    try {
      const featureName = match[1];
      features.toggle(featureName, false);

      logger.info(`Feature o'chirildi: ${featureName}`, chatId);
      bot.sendMessage(chatId, `❌ ${featureName} o'chirildi`);
    } catch (err) {
      logger.error("Feature OFF error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};
