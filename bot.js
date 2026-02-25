// ========== bot.js (YANGILANGAN) ==========
const config = require("./config/environment");
const features = require("./config/features");
const logger = require("./utils/logger");
const TelegramBot = require("node-telegram-bot-api");

const connectDB = require("./config/database");

// ✅ HANDLERS
const startHandler = require("./handlers/start");
const registrationHandler = require("./handlers/registration");
const profileHandler = require("./handlers/profile");
const adminHandler = require("./handlers/admin/admin");
const passengerHandler = require("./handlers/passenger");
const groupHandler = require("./handlers/group");
const featureHandler = require("./handlers/features");
const driverHandler = require("./handlers/driver");
const cargoHandler = require("./handlers/cargo");
const menuHandler = require("./handlers/menu");
const statisticsHandler = require("./handlers/statistics");
const ratingHandler = require("./handlers/rating");
const historyHandler = require("./handlers/history");
const aboutHandler = require("./handlers/about");

// ✅ MIDDLEWARES
const errorMiddleware = require("./middlewares/errorHandler");
const loggerMiddleware = require("./middlewares/logger");

async function startBot() {
  try {
    await connectDB();

    const bot = new TelegramBot(config.BOT_TOKEN, {
      polling: true,
    });

    logger.success(`Bot ishga tushdi [${config.NODE_ENV.toUpperCase()}] 🚀`);

    // Features
    if (config.IS_DEVELOPMENT) {
      console.log("\n📋 ENABLED FEATURES:");
      try {
        const featureList = features.list();
        if (featureList && typeof featureList === "object") {
          Object.entries(featureList).forEach(([name, enabled]) => {
            logger.feature(name, enabled);
          });
        }
      } catch (err) {
        logger.error("Features yuklashda xato:", err);
      }
      console.log("");
    }

    // MIDDLEWARES
    loggerMiddleware(bot);
    errorMiddleware(bot);

    // HANDLERS
    startHandler(bot);
    registrationHandler(bot);
    statisticsHandler(bot);
    ratingHandler(bot);
    historyHandler(bot);
    profileHandler(bot);
    passengerHandler(bot);
    cargoHandler(bot);
    driverHandler(bot);
    adminHandler(bot);
    groupHandler(bot);
    featureHandler(bot);
    menuHandler(bot);
    aboutHandler(bot);

    logger.info("✅ Barcha handler'lar yuklandi");
  } catch (err) {
    logger.error("BOT START XATOSI:", err.message);
    process.exit(1);
  }
}

startBot();
