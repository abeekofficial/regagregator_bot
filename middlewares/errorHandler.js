// ========== middlewares/errorHandler.js ==========
const logger = require("../utils/logger");

module.exports = (bot) => {
  // ✅ POLLING ERRORS
  bot.on("polling_error", (error) => {
    logger.error("Polling error:", error.message);

    // Agar jiddiy xato bo'lsa
    if (error.message.includes("ETELEGRAM")) {
      logger.error("Telegram API xatosi - bot to'xtatilmoqda");
      process.exit(1);
    }
  });

  // ✅ UNHANDLED PROMISE REJECTIONS
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection:", reason);
    console.error("Promise:", promise);
  });

  // ✅ UNCAUGHT EXCEPTIONS
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    console.error("Stack:", error.stack);

    // Graceful shutdown
    process.exit(1);
  });

  // ✅ PROCESS TERMINATION
  process.on("SIGINT", () => {
    logger.warning("Bot to'xtatilmoqda (SIGINT)...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.warning("Bot to'xtatilmoqda (SIGTERM)...");
    process.exit(0);
  });

  logger.info("Error handlers yuklandi");
};
