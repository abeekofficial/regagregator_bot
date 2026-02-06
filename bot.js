const config = require("./config/environment");
const features = require("./config/features");
const logger = require("./utils/logger");
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");

const User = require("./models/user.model");
const state = require("./utils/state");

mongoose.set("bufferCommands", false);

async function startBot() {
  try {
    // 1️⃣ MongoDB
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.success(
      `MongoDB ulandi [${config.NODE_ENV.toUpperCase()}]`,
      config.MONGO_URI.split("@")[1]?.split("?")[0],
    );

    // 2️⃣ BOTNI YARATISH
    const bot = new TelegramBot(config.BOT_TOKEN, {
      polling: true,
    });

    logger.success(`Bot ishga tushdi [${config.NODE_ENV.toUpperCase()}] 🚀`);

    // 3️⃣ Features ro'yxati
    if (config.IS_DEVELOPMENT) {
      console.log("\n📋 ENABLED FEATURES:");
      Object.entries(features.features).forEach(([name, enabled]) => {
        logger.feature(name, enabled);
      });
      console.log("");
    }

    // 4️⃣ Message logger
    bot.on("message", (msg) => {
      logger.debug("Xabar keldi:", {
        user: msg.from.id,
        text: msg.text,
        username: msg.from.username,
      });
    });

    // 5️⃣ /start
    bot.onText(/\/start(.*)/, async (msg) => {
      const chatId = msg.chat.id;
      logger.info("START bosildi:", chatId);

      try {
        let user = await User.findOne({ telegramId: chatId });
        if (!user) {
          await User.create({ telegramId: chatId });
          logger.success("Yangi user yaratildi:", chatId);
        }

        bot.sendMessage(
          chatId,
          `🚕 Assalamu aleykum Taksi botga xush kelibsiz!\n${
            config.IS_DEVELOPMENT ? "⚠️ TEST BOT\n" : ""
          }Kim sifatida kirmoqchisiz?`,
          {
            reply_markup: {
              keyboard: [["🚕 Haydovchi", "🧍 Yo'lovchi"]],
              resize_keyboard: true,
            },
          },
        );
      } catch (err) {
        logger.error("Start error:", err);
        bot.sendMessage(chatId, "❌ Xatolik yuz berdi, /start ni qayta bosing");
      }
    });

    // 6️⃣ ROLE TANLASH
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      try {
        if (text === "🧍 Yo'lovchi") {
          state.set(chatId, { step: "PASSENGER_NAME", role: "passenger" });
          logger.info("Yo'lovchi tanlandi:", chatId);
          return bot.sendMessage(chatId, "👤 Ism Familiyangizni kiriting:");
        }

        if (text === "🚕 Haydovchi") {
          state.set(chatId, { step: "DRIVER_NAME", role: "driver" });
          logger.info("Haydovchi tanlandi:", chatId);
          return bot.sendMessage(chatId, "👤 Ism Familiyangizni kiriting:");
        }

        // YO'LOVCHI REGISTRATION
        const userState = state.get(chatId);
        if (!userState) return;

        if (userState.step === "PASSENGER_NAME") {
          userState.name = text;
          userState.step = "PASSENGER_PHONE";
          state.set(chatId, userState);
          return bot.sendMessage(
            chatId,
            "📱 Telefon raqamingizni kiriting:\n(Masalan: +998901234567)",
            {
              reply_markup: {
                keyboard: [
                  [
                    {
                      text: "📱 Telefon raqamni yuborish",
                      request_contact: true,
                    },
                  ],
                ],
                resize_keyboard: true,
              },
            },
          );
        }

        if (userState.step === "PASSENGER_PHONE") {
          const phone = msg.contact ? msg.contact.phone_number : text;
          await User.findOneAndUpdate(
            { telegramId: chatId },
            { role: "passenger", name: userState.name, phone: phone },
          );
          state.clear(chatId);
          logger.success("Yo'lovchi ro'yxatdan o'tdi:", {
            id: chatId,
            name: userState.name,
          });
          return bot.sendMessage(
            chatId,
            "✅ Ro'yxatdan o'tdingiz!\nEndi buyurtma berishingiz mumkin.",
            {
              reply_markup: {
                keyboard: [["🚖 Buyurtma berish"], ["👤 Profilim"]],
                resize_keyboard: true,
              },
            },
          );
        }

        // HAYDOVCHI REGISTRATION
        if (userState.step === "DRIVER_NAME") {
          userState.name = text;
          userState.step = "DRIVER_PHONE";
          state.set(chatId, userState);
          return bot.sendMessage(chatId, "📱 Telefon raqamingizni kiriting:", {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "📱 Telefon raqamni yuborish",
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
            },
          });
        }

        if (userState.step === "DRIVER_PHONE") {
          const phone = msg.contact ? msg.contact.phone_number : text;
          userState.phone = phone;
          userState.step = "DRIVER_CAR_MODEL";
          state.set(chatId, userState);
          return bot.sendMessage(
            chatId,
            "🚗 Mashina modelingizni kiriting:\n(Masalan: Chevrolet Lacetti)",
          );
        }

        if (userState.step === "DRIVER_CAR_MODEL") {
          userState.carModel = text;
          userState.step = "DRIVER_CAR_NUMBER";
          state.set(chatId, userState);
          return bot.sendMessage(
            chatId,
            "🔢 Mashina raqamingizni kiriting:\n(Masalan: 01 A 777 AA)",
          );
        }

        if (userState.step === "DRIVER_CAR_NUMBER") {
          userState.carNumber = text;
          userState.step = "DRIVER_FROM";
          state.set(chatId, userState);
          return bot.sendMessage(
            chatId,
            "📍 Qayerdan yo'lovchi olib ketasiz?",
            require("./utils/regionOptions").createInlineKeyboard(),
          );
        }
      } catch (err) {
        logger.error("Message handler error:", err);
        bot.sendMessage(
          chatId,
          "❌ Xatolik yuz berdi, qaytadan urinib ko'ring",
        );
      }
    });

    // 7️⃣ CALLBACK QUERY
    bot.on("callback_query", async (query) => {
      const chatId = query.message.chat.id;
      const data = query.data;

      try {
        const userState = state.get(chatId);
        if (!userState || userState.role !== "driver") return;

        if (data.startsWith("region_") && userState.step === "DRIVER_FROM") {
          const regionCode = data.replace("region_", "");
          userState.from = regionCode;
          userState.step = "DRIVER_TO";
          state.set(chatId, userState);

          await bot.answerCallbackQuery(query.id);
          return bot.sendMessage(
            chatId,
            "📍 Qayerga yo'lovchi olib borasiz?",
            require("./utils/regionOptions").createInlineKeyboard(),
          );
        }

        if (data.startsWith("region_") && userState.step === "DRIVER_TO") {
          const regionCode = data.replace("region_", "");
          userState.to = regionCode;

          await User.findOneAndUpdate(
            { telegramId: chatId },
            {
              role: "driver",
              name: userState.name,
              phone: userState.phone,
              carModel: userState.carModel,
              carNumber: userState.carNumber,
              from: userState.from,
              to: userState.to,
            },
          );

          state.clear(chatId);
          logger.success("Haydovchi ro'yxatdan o'tdi:", {
            id: chatId,
            name: userState.name,
          });

          await bot.answerCallbackQuery(query.id);
          return bot.sendMessage(
            chatId,
            "✅ Ro'yxatdan o'tdingiz!\nEndi buyurtmalarni qabul qila olasiz.",
            {
              reply_markup: {
                keyboard: [["📋 Buyurtmalar"], ["👤 Profilim"]],
                resize_keyboard: true,
              },
            },
          );
        }
      } catch (err) {
        logger.error("Callback handler error:", err);
        bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
      }
    });

    // 8️⃣ ADMIN VA PASSENGER HANDLERLARNI IMPORT QILISH
    require("./handlers/admin")(bot);
    require("./handlers/passenger")(bot);

    // 9️⃣ FEATURE MANAGEMENT (Faqat super admin uchun)
    const { isSuperAdmin } = require("./utils/isAdmin");

    bot.onText(/\/features/, async (msg) => {
      const chatId = msg.chat.id;
      if (!isSuperAdmin(chatId)) return;

      const featureList = Object.entries(features.list())
        .map(([name, enabled]) => `${enabled ? "✅" : "❌"} ${name}`)
        .join("\n");

      bot.sendMessage(
        chatId,
        `🔧 FEATURES:\n\n${featureList}\n\nYoqish: /feature_on PAYMENT_SYSTEM\nO'chirish: /feature_off PAYMENT_SYSTEM`,
      );
    });

    bot.onText(/\/feature_on (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      if (!isSuperAdmin(chatId)) return;

      const featureName = match[1];
      features.toggle(featureName, true);
      bot.sendMessage(chatId, `✅ ${featureName} yoqildi`);
    });

    bot.onText(/\/feature_off (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      if (!isSuperAdmin(chatId)) return;

      const featureName = match[1];
      features.toggle(featureName, false);
      bot.sendMessage(chatId, `❌ ${featureName} o'chirildi`);
    });

    // 🔟 Error handling
    bot.on("polling_error", (error) => {
      logger.error("Polling error:", error.message);
    });

    process.on("unhandledRejection", (error) => {
      logger.error("Unhandled rejection:", error);
    });
  } catch (err) {
    logger.error("BOT START XATOSI:", err.message);
    process.exit(1);
  }
}

startBot();
