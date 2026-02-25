// ========== middlewares/logger.js ==========
const logger = require("../utils/logger");

module.exports = (bot) => {
  bot.on("message", (msg) => {
    // Faqat text xabarlarni log qilish
    if (msg.text) {
      logger.debug("Xabar keldi:", {
        user: msg.from.id,
        text: msg.text.substring(0, 50), // Faqat birinchi 50 belgi
        username: msg.from.username,
      });
    }

    // Photo xabarlar
    if (msg.photo) {
      logger.debug("Rasm yuborildi:", {
        user: msg.from.id,
        username: msg.from.username,
      });
    }

    // Contact xabarlar
    if (msg.contact) {
      logger.debug("Kontakt yuborildi:", {
        user: msg.from.id,
        phone: msg.contact.phone_number,
      });
    }
  });

  // Callback query logging
  bot.on("callback_query", (query) => {
    logger.debug("Callback query:", {
      user: query.from.id,
      data: query.data,
    });
  });
};
