// ========== bot.js (FULL FIXED VERSION) ==========
const config = require("./config/environment");
const features = require("./config/features");
const logger = require("./utils/logger");
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");

const User = require("./models/user.model");
const Session = require("./models/session.model");
const { handleReferral } = require("./handlers/referal");

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

    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("IS_DEVELOPMENT:", config.IS_DEVELOPMENT);

    // 4️⃣ Message logger
    bot.on("message", (msg) => {
      logger.debug("Xabar keldi:", {
        user: msg.from.id,
        text: msg.text,
        username: msg.from.username,
      });
    });

    // ========== HELPER FUNCTIONS ==========

    async function showMainMenu(bot, chatId, user) {
      try {
        const botInfo = await bot.getMe();
        const botUsername = botInfo.username;

        // ✅ AGAR REFERRAL CODE BO'LMASA - YARATISH
        if (!user.referralCode) {
          user.referralCode = `REF${user.telegramId}${Date.now().toString(36).toUpperCase()}`;
          await user.save();
        }

        const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

        let message = "";
        let keyboard = [];

        // ✅ PASSENGER
        if (user.role === "passenger") {
          message = `👋 Xush kelibsiz${user.name ? `, ${user.name}` : ""}!\n\n`;
          message += `📊 Sizning statistikangiz:\n`;
          message += `💰 Bonus: ${user.referralEarnings || 0} so'm\n`;
          message += `👥 Taklif qilganlar: ${user.referralCount || 0} ta\n\n`;
          message += `🎁 Referal havolangiz:\n${referralLink}`;

          keyboard = [
            ["🚖 Buyurtma berish"],
            ["👤 Profilim", "💰 Balansim"],
            ["📊 Tarixim"],
          ];
        }
        // ✅ DRIVER
        else if (user.role === "driver") {
          message = `🚗 Xush kelibsiz${user.name ? `, ${user.name}` : ""}!\n\n`;
          message += `📊 Sizning statistikangiz:\n`;
          message += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n`;
          message += `📦 Bajarilgan: ${user.completedOrders || 0} ta\n`;
          message += `👥 Taklif qilganlar: ${user.referralCount || 0} ta\n\n`;

          const priorityLevel =
            (user.referralCount || 0) > 10 ? "Yuqori" : "O'rta";
          message += `📈 Priority: ${user.referralCount || 0} (${priorityLevel})\n\n`;
          message += `🎁 Referal havolangiz:\n${referralLink}`;

          keyboard = [
            ["📋 Buyurtmalar"],
            ["👤 Profilim", "📊 Statistika"],
            ["⭐ Reytingim"],
          ];
        }
        // ✅ ADMIN
        else if (config.ADMIN_IDS.includes(chatId)) {
          message = `👑 ADMIN PANEL\n\nXush kelibsiz!`;
          keyboard = [
            ["📊 Statistika", "👥 Foydalanuvchilar"],
            ["🚫 Bloklangan", "💬 Guruhlar"],
            ["📈 Hisobotlar", "🔧 Sozlamalar"],
          ];
        }
        // ✅ ROLE YO'Q
        else {
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
        console.error("showMainMenu error:", err);
        bot.sendMessage(chatId, "❌ Xatolik yuz berdi, /start ni qayta bosing");
      }
    }

    // 5️⃣ /start - REFERAL SUPPORT BILAN
    bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const referralCode = match[1]?.trim();
      logger.info("START bosildi:", chatId);

      try {
        let user = await User.findOne({ telegramId: chatId });

        // ✅ AGAR USER MAVJUD BO'LSA - MAIN MENU
        if (user && user.role) {
          return showMainMenu(bot, chatId, user);
        }

        // ✅ YANGI USER
        if (!user) {
          user = await User.create({
            telegramId: chatId,
            username: msg.from.username,
          });
          logger.success("Yangi user yaratildi:", chatId);
        }

        // ✅ REFERAL BILAN KELGAN BO'LSA
        let referralInfo = "";
        if (referralCode && referralCode.startsWith("REF")) {
          const result = await handleReferral(bot, msg, referralCode);
          if (result.success) {
            if (result.inviterRole === "passenger") {
              referralInfo = `\n\n🎁 ${result.inviterName} sizni taklif qildi!\n💰 Siz ro'yxatdan o'tgach, u 5000 so'm bonus oladi!`;
            } else {
              referralInfo = `\n\n🚗 Haydovchi ${result.inviterName} sizni taklif qildi!\nU buyurtma olishda yuqori prioritetga ega bo'ladi!`;
            }
          }
        }

        bot.sendMessage(
          chatId,
          `🚕 Assalamu aleykum! Taksi botga xush kelibsiz!${referralInfo}\n${
            config.IS_DEVELOPMENT ? "\n⚠️ TEST BOT\n" : ""
          }\nKim sifatida kirmoqchisiz?`,
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

    // 6️⃣ ROLE TANLASH VA REGISTRATION
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

        // ========== SESSION ORQALI ISHLASH ==========
        let session = await Session.findOne({ telegramId: chatId });

        // ✅ SESSION YO'Q BO'LSA - CHIQISH
        if (!session) return;

        // ========== YO'LOVCHI REGISTRATION ==========
        if (session.step === "PASSENGER_NAME") {
          session.data = session.data || {};
          session.data.name = text;
          session.step = "PASSENGER_PHONE";
          await session.save();

          console.log("✅ PASSENGER_NAME:", session.data.name);

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

        if (session.step === "PASSENGER_PHONE") {
          const phone = msg.contact ? msg.contact.phone_number : text;

          session.data = session.data || {};
          session.data.phone = phone;
          await session.save();

          console.log("✅ PASSENGER_PHONE:", session.data.phone);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          // ✅ USER YANGILASH
          const user = await User.findOneAndUpdate(
            { telegramId: chatId },
            {
              $set: {
                role: "passenger",
                name: session.data.name,
                phone: session.data.phone,
              },
            },
            { new: true },
          );

          await Session.deleteMany({ telegramId: chatId });

          logger.success("Yo'lovchi ro'yxatdan o'tdi:", {
            id: chatId,
            name: user.name,
          });

          // ✅ REFERAL CODE
          if (!user.referralCode) {
            user.referralCode = `REF${user.telegramId}${Date.now().toString(36).toUpperCase()}`;
            await user.save();
          }

          const botInfo = await bot.getMe();
          const referralLink = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

          let welcomeMsg = `✅ RO'YXATDAN O'TDINGIZ!\n\n`;
          welcomeMsg += `👤 Ism: ${user.name}\n`;
          welcomeMsg += `📱 Telefon: ${user.phone}\n\n`;
          welcomeMsg += `🎁 REFERAL DASTURI:\n`;
          welcomeMsg += `Do'stlaringizni taklif qiling va har biri uchun 5000 so'm bonus oling!\n\n`;
          welcomeMsg += `📎 Sizning havolangiz:\n${referralLink}\n\n`;
          welcomeMsg += `💰 Joriy balans: ${user.referralEarnings || 0} so'm`;

          bot.sendMessage(chatId, welcomeMsg, {
            reply_markup: {
              keyboard: [["🚖 Buyurtma berish"], ["👤 Profilim"]],
              resize_keyboard: true,
            },
          });

          return;
        }

        // ========== HAYDOVCHI REGISTRATION ==========
        if (session.step === "DRIVER_NAME") {
          session.data = session.data || {};
          session.data.name = text;
          session.step = "DRIVER_PHONE";
          await session.save();

          console.log("✅ DRIVER_NAME:", session.data.name);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

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

        if (session.step === "DRIVER_PHONE") {
          const phone = msg.contact ? msg.contact.phone_number : text;

          session.data = session.data || {};
          session.data.phone = phone;
          session.step = "DRIVER_PHOTO";
          await session.save();

          console.log("✅ DRIVER_PHONE:", session.data.phone);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          return bot.sendMessage(
            chatId,
            "📸 O'zingiz va mashinangiz rasmi bilan bitta RASM yuboring:",
            { reply_markup: { remove_keyboard: true } },
          );
        }

        if (session.step === "DRIVER_PHOTO") {
          if (!msg.photo) {
            return bot.sendMessage(chatId, "❌ Iltimos rasm yuboring!");
          }

          const fileId = msg.photo[msg.photo.length - 1].file_id;

          session.data = session.data || {};
          session.data.driverPhoto = fileId;
          session.step = "DRIVER_CAR_MODEL";
          await session.save();

          console.log("✅ DRIVER_PHOTO:", session.data.driverPhoto);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          return bot.sendMessage(
            chatId,
            "🚗 Mashina modelingizni kiriting:\n(Masalan: Chevrolet Lacetti)",
          );
        }

        if (session.step === "DRIVER_CAR_MODEL") {
          session.data = session.data || {};
          session.data.carModel = text;
          session.step = "DRIVER_CAR_NUMBER";
          await session.save();

          console.log("✅ DRIVER_CAR_MODEL:", session.data.carModel);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          return bot.sendMessage(
            chatId,
            "🔢 Mashina raqamingizni kiriting:\n(Masalan: 01 A 777 AA)",
          );
        }

        if (session.step === "DRIVER_CAR_NUMBER") {
          session.data = session.data || {};
          session.data.carNumber = text;
          session.step = "DRIVER_FROM";
          await session.save();

          console.log("✅ DRIVER_CAR_NUMBER:", session.data.carNumber);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          return bot.sendMessage(
            chatId,
            "📍 Qayerdan yo'lovchi olib ketasiz?",
            require("./utils/regionOptions").createInlineKeyboard(),
          );
        }
      } catch (err) {
        logger.error("Message handler error:", err);
        console.error("❌ FULL ERROR:", err);
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
        let session = await Session.findOne({ telegramId: chatId });

        // ✅ SESSION YO'Q BO'LSA - XABAR BERISH
        if (!session) {
          await bot.answerCallbackQuery(query.id, {
            text: "❌ Session topilmadi. /start bosing",
            show_alert: true,
          });
          return;
        }

        // ✅ STEP YO'Q BO'LSA - XABAR BERISH
        if (!session.step) {
          await bot.answerCallbackQuery(query.id, {
            text: "❌ Session step topilmadi. /start bosing",
            show_alert: true,
          });
          return;
        }

        // ========== DRIVER FROM ==========
        if (data.startsWith("region_") && session.step === "DRIVER_FROM") {
          const regionCode = data.replace("region_", "");

          session.data = session.data || {};
          session.data.from = regionCode;
          session.step = "DRIVER_TO";
          await session.save();

          console.log("✅ DRIVER_FROM:", session.data.from);
          console.log(
            "📊 SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          await bot.answerCallbackQuery(query.id);
          return bot.sendMessage(
            chatId,
            "📍 Qayerga yo'lovchi olib borasiz?",
            require("./utils/regionOptions").createInlineKeyboard(),
          );
        }

        // ========== DRIVER TO ==========
        if (data.startsWith("region_") && session.step === "DRIVER_TO") {
          const regionCode = data.replace("region_", "");

          session.data = session.data || {};
          session.data.to = regionCode;
          await session.save();

          console.log(
            "📊 FINAL SESSION DATA:",
            JSON.stringify(session.data, null, 2),
          );

          // ✅ USER YANGILASH
          const updateData = {
            $set: {
              role: session.data.role || "driver",
              name: session.data.name,
              phone: session.data.phone,
              driverPhoto: session.data.driverPhoto,
              carModel: session.data.carModel,
              carNumber: session.data.carNumber,
              from: session.data.from,
              to: session.data.to,
              isActive: true,
            },
          };

          console.log("💾 UPDATE DATA:", JSON.stringify(updateData, null, 2));

          const user = await User.findOneAndUpdate(
            { telegramId: chatId },
            updateData,
            { new: true },
          );

          await Session.deleteMany({ telegramId: chatId });

          console.log("✅ User saqlandi:", {
            id: user.telegramId,
            name: user.name,
            phone: user.phone,
            carModel: user.carModel,
            carNumber: user.carNumber,
            from: user.from,
            to: user.to,
          });

          logger.success("Haydovchi ro'yxatdan o'tdi:", {
            id: chatId,
            name: user.name,
          });

          await bot.answerCallbackQuery(query.id);

          // ✅ REFERAL CODE
          if (!user.referralCode) {
            user.referralCode = `REF${user.telegramId}${Date.now().toString(36).toUpperCase()}`;
            await user.save();
          }

          const botInfo = await bot.getMe();
          const referralLink = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

          let welcomeMsg = `✅ RO'YXATDAN O'TDINGIZ!\n\n`;
          welcomeMsg += `👤 Ism: ${user.name}\n`;
          welcomeMsg += `📱 Telefon: ${user.phone}\n`;
          welcomeMsg += `🚙 Mashina: ${user.carModel}\n`;
          welcomeMsg += `🔢 Raqam: ${user.carNumber}\n`;
          welcomeMsg += `📍 Yo'nalish: ${user.from} → ${user.to}\n\n`;

          welcomeMsg += `🚗 REFERAL DASTURI:\n`;
          welcomeMsg += `Do'stlaringizni taklif qiling - prioritetingiz oshadi!\n\n`;
          welcomeMsg += `📎 Sizning havolangiz:\n${referralLink}\n\n`;
          welcomeMsg += `📊 Referallar: ${user.referralCount || 0} ta\n`;
          welcomeMsg += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n\n`;
          welcomeMsg += `⚠️ MUHIM:\n`;
          welcomeMsg += `• 3 marta rad etsangiz - bloklanasiz\n`;
          welcomeMsg += `• Rating < 3.0 - admin tekshiradi\n`;
          welcomeMsg += `• Priority: Referal → Rating`;

          return bot.sendMessage(chatId, welcomeMsg, {
            reply_markup: {
              keyboard: [["📋 Buyurtmalar"], ["👤 Profilim"]],
              resize_keyboard: true,
            },
          });
        }
      } catch (err) {
        logger.error("Callback error:", err);
        console.error("❌ FULL ERROR:", err);

        await bot.answerCallbackQuery(query.id, {
          text: "❌ Xatolik!",
          show_alert: true,
        });

        bot.sendMessage(chatId, "❌ Xatolik, /start bosing");
      }
    });

    // 8️⃣ PROFILIM
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

        if (user.role === "driver") {
          profileMsg += `🚗 HAYDOVCHI:\n`;
          profileMsg += `🚙 Mashina: ${user.carModel || "❌"}\n`;
          profileMsg += `🔢 Raqam: ${user.carNumber || "❌"}\n`;
          profileMsg += `📍 ${user.from || "?"} → ${user.to || "?"}\n`;
          profileMsg += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n`;
          profileMsg += `📦 Buyurtmalar: ${user.completedOrders || 0}\n\n`;
        }

        profileMsg += `🎁 REFERAL:\n`;
        profileMsg += `👥 Taklif qilganlar: ${user.referralCount || 0}\n`;

        if (user.role === "passenger") {
          profileMsg += `💰 Bonus: ${user.referralEarnings || 0} so'm\n`;
        }

        profileMsg += `\n📎 Havolangiz:\n${referralLink}`;

        bot.sendMessage(chatId, profileMsg);
      } catch (err) {
        console.error("Profilim error:", err);
        bot.sendMessage(chatId, "❌ Xatolik");
      }
    });

    // 9️⃣ HANDLERS
    require("./handlers/admin")(bot);
    require("./handlers/passenger")(bot);
    require("./handlers/group")(bot);

    // 🔟 FEATURES
    const { isSuperAdmin } = require("./utils/isAdmin");

    bot.onText(/\/features/, async (msg) => {
      const chatId = msg.chat.id;
      if (!isSuperAdmin(chatId)) return;

      const featureList = Object.entries(features.list())
        .map(([name, enabled]) => `${enabled ? "✅" : "❌"} ${name}`)
        .join("\n");

      bot.sendMessage(
        chatId,
        `🔧 FEATURES:\n\n${featureList}\n\n/feature_on NAME\n/feature_off NAME`,
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

    // 1️⃣1️⃣ ERROR HANDLING
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
