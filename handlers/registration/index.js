// ========== handlers/registration/index.js (YANGILANGAN) ==========
const passengerRegistration = require("./passenger");
const driverRegistration = require("./driver");
const Session = require("../../models/session.model");
const logger = require("../../utils/logger");

module.exports = (bot) => {
  // ========== MESSAGE HANDLER ==========
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    try {
      // ========== ROLE TANLASH ==========
      if (text === "🧍 Yo'lovchi") {
        await Session.deleteMany({ telegramId: chatId });

        await Session.create({
          telegramId: chatId,
          step: "PASSENGER_NAME",
          data: { role: "passenger" },
        });

        logger.info("Yo'lovchi tanlandi:", chatId);
        return bot.sendMessage(chatId, "👤 Ism Familiyangizni kiriting:");
      }

      if (text === "🚕 Haydovchi") {
        await Session.deleteMany({ telegramId: chatId });

        await Session.create({
          telegramId: chatId,
          step: "DRIVER_NAME",
          data: { role: "driver" },
        });

        logger.info("Haydovchi tanlandi:", chatId);
        return bot.sendMessage(chatId, "👤 Ism Familiyangizni kiriting:");
      }

      // ========== SESSION ORQALI ROUTING ==========
      const session = await Session.findOne({ telegramId: chatId });

      // Session yo'q bo'lsa - chiqish
      if (!session) return;

      // Role bo'yicha yo'naltirish
      if (session.data?.role === "passenger") {
        return passengerRegistration.handleMessage(bot, msg, session);
      }

      if (session.data?.role === "driver") {
        return driverRegistration.handleMessage(bot, msg, session);
      }
    } catch (err) {
      logger.error("Registration router error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi, qaytadan urinib ko'ring");
    }
  });

  // ❌ CALLBACK QUERY HANDLER - O'CHIRILDI
  // Endi callbackRouter.js ishlatiladi
};

// ✅ EXPORT driver callback handler
module.exports.handleDriverCallback = driverRegistration.handleCallback;
