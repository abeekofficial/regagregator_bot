// ========== handlers/passenger.js (TO'LIQ TUZATILGAN) ==========
const Session = require("../models/session.model");
const Order = require("../models/Order.model");
const { createInlineKeyboard } = require("../utils/regionOptions");
const assignOrder = require("./orderAssign");
const logger = require("../utils/logger");

module.exports = (bot) => {
  // ========== 1️⃣ YO'LOVCHI BUYURTMA BERISH ==========
  bot.onText(/🚖 Buyurtma berish/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      await Session.deleteMany({ telegramId: chatId });

      await Session.create({
        telegramId: chatId,
        step: "ORDER_FROM_REGION",
        data: { role: "order", orderType: "passenger" },
      });

      logger.info("Yo'lovchi buyurtma boshladi:", chatId);

      bot.sendMessage(
        chatId,
        "📍 Qayerdan yo'lga chiqasiz?",
        createInlineKeyboard(),
      );
    } catch (err) {
      logger.error("Buyurtma berish error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== 2️⃣ CALLBACK QUERY HANDLER ==========
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      const session = await Session.findOne({ telegramId: chatId });

      // ========== REGION TANLASH (faqat yo'lovchi order uchun) ==========
      if (session && session.data?.role === "order") {
        if (data.startsWith("region_")) {
          const regionCode = data.replace("region_", "");

          // FROM tanlandi
          if (session.step === "ORDER_FROM_REGION") {
            session.data.from = regionCode;
            session.step = "ORDER_TO_REGION";
            session.markModified("data");
            await session.save();

            logger.info("Yo'lovchi FROM tanladi:", {
              chatId,
              from: regionCode,
            });

            await bot.answerCallbackQuery(query.id);
            return bot.sendMessage(
              chatId,
              "📍 Qayerga borasiz?",
              createInlineKeyboard(),
            );
          }

          // TO tanlandi
          if (session.step === "ORDER_TO_REGION") {
            session.data.to = regionCode;
            session.markModified("data");
            await session.save();

            logger.info("Yo'lovchi TO tanladi:", { chatId, to: regionCode });

            await bot.answerCallbackQuery(query.id);

            // ✅ Buyurtma turiga qarab keyingi qadam
            if (session.data.orderType === "cargo") {
              // Yuk uchun - tavsif so'rash
              session.step = "ORDER_CARGO_DESCRIPTION";
              await session.save();

              return bot.sendMessage(
                chatId,
                "📦 Yuk haqida qisqacha yozing:\n(masalan: 20 kg un, kichik quti, hujjatlar...)",
              );
            } else {
              // Yo'lovchi uchun - nechta yo'lovchi
              session.step = "ORDER_PASSENGER_COUNT";
              await session.save();

              return bot.sendMessage(chatId, "👥 Nechta yo'lovchisiz?", {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "1️⃣ 1 kishi", callback_data: "pcount_1" },
                      { text: "2️⃣ 2 kishi", callback_data: "pcount_2" },
                    ],
                    [
                      { text: "3️⃣ 3 kishi", callback_data: "pcount_3" },
                      { text: "4️⃣ 4 kishi", callback_data: "pcount_4" },
                    ],
                  ],
                },
              });
            }
          }
        }

        // ========== YO'LOVCHI SONI TANLASH ==========
        if (
          data.startsWith("pcount_") &&
          session.step === "ORDER_PASSENGER_COUNT"
        ) {
          const count = parseInt(data.replace("pcount_", ""));
          session.data.passengerCount = count;
          session.markModified("data");
          await session.save();

          await bot.answerCallbackQuery(query.id);

          // Buyurtma yaratish
          await createAndSendOrder(bot, chatId, session);
          return;
        }
      }

      // ========== PASSENGER TASDIQLASH ==========
      if (data.startsWith("confirm_complete_btn_")) {
        const orderId = data.replace("confirm_complete_btn_", "");
        const order = await Order.findById(orderId);

        if (!order || order.passengerId !== chatId) {
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Bu sizning buyurtmangiz emas!",
            show_alert: true,
          });
        }

        if (order.status === "completed") {
          return bot.answerCallbackQuery(query.id, {
            text: "✅ Bu buyurtma allaqachon yakunlangan!",
            show_alert: true,
          });
        }

        if (order.status === "driver_confirmed") {
          order.status = "completed";
          order.completedAt = new Date();
          await order.save();

          // Driver statistikasini yangilash
          await require("../models/user.model").findOneAndUpdate(
            { telegramId: order.driverId },
            { $inc: { completedOrders: 1 } },
          );

          await bot.answerCallbackQuery(query.id, {
            text: "✅ Safar yakunlandi!",
          });

          await bot.editMessageText(
            `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\nRahmat!`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: { inline_keyboard: [] },
            },
          );

          bot.sendMessage(
            chatId,
            `⭐ Haydovchini baholang: /rate_driver_${orderId}`,
          );

          bot.sendMessage(
            order.driverId,
            `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\n⭐ Yo'lovchini baholang: /rate_passenger_${orderId}`,
          );
        } else {
          order.status = "passenger_confirmed";
          order.passengerConfirmedAt = new Date();
          await order.save();

          await bot.answerCallbackQuery(query.id, {
            text: "✅ Siz tasdiqladingiz! Driver tasdiqini kutmoqda...",
          });

          await bot.editMessageText(
            `✅ Siz safar tugaganini tasdiqladingiz!\n\n⏳ Haydovchi tasdiqini kutmoqda...`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: { inline_keyboard: [] },
            },
          );

          bot.sendMessage(
            order.driverId,
            `👤 Yo'lovchi safar tugaganini bildirdi.\n\n📍 ${order.from} → ${order.to}\n\nSafar yakunlandimi?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Ha, yakunlandi",
                      callback_data: `complete_order_${orderId}`,
                    },
                    { text: "❌ Yo'q", callback_data: `dispute_${orderId}` },
                  ],
                ],
              },
            },
          );
        }
      }

      // ========== DISPUTE (Nizo) ==========
      if (data.startsWith("dispute_")) {
        const orderId = data.replace("dispute_", "");

        await bot.answerCallbackQuery(query.id, {
          text: "📞 Adminlar bilan bog'laning!",
          show_alert: true,
        });

        const newText = `⚠️ MUAMMO YUZAGA KELDI!\n\n🆔 Buyurtma: ${orderId.slice(-6)}\n\n📞 Iltimos, admin bilan bog'laning:\n@admin\n\n📝 Muammo tavsifi:\nSafar yakunlanishi haqida kelishmovchilik`;

        try {
          await bot.editMessageText(newText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: [] },
          });
        } catch (editErr) {
          bot.sendMessage(chatId, newText);
        }

        logger.error(`Nizo: Order ${orderId}, Passenger ${chatId}`);
      }
    } catch (err) {
      logger.error("Passenger callback error:", err);
      try {
        await bot.answerCallbackQuery(query.id, {
          text: "❌ Xatolik yuz berdi!",
          show_alert: true,
        });
      } catch (e) {
        // Ignore
      }
    }
  });

  // ========== YUK TAVSIFI MATN QABUL QILISH ==========
  bot.on("message", async (msg) => {
    if (!msg.text || msg.chat.type !== "private") return;

    const chatId = msg.chat.id;

    try {
      const session = await Session.findOne({ telegramId: chatId });

      if (
        session &&
        session.data?.role === "order" &&
        session.step === "ORDER_CARGO_DESCRIPTION"
      ) {
        session.data.cargoDescription = msg.text;
        session.markModified("data");
        await session.save();

        await createAndSendOrder(bot, chatId, session);
      }
    } catch (err) {
      logger.error("Cargo description error:", err);
    }
  });

  // ========== 4️⃣ SAFAR YAKUNLASH (Text command) ==========
  bot.onText(/\/confirm_complete_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];

    try {
      const order = await Order.findById(orderId);

      if (!order || order.passengerId !== chatId) {
        return bot.sendMessage(chatId, "❌ Bu sizning buyurtmangiz emas!");
      }

      if (order.status === "completed") {
        return bot.sendMessage(
          chatId,
          "✅ Bu buyurtma allaqachon yakunlangan!",
        );
      }

      if (order.status === "driver_confirmed") {
        order.status = "completed";
        order.completedAt = new Date();
        await order.save();

        bot.sendMessage(
          chatId,
          `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\n⭐ Haydovchini baholang: /rate_driver_${orderId}`,
        );

        bot.sendMessage(
          order.driverId,
          `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\n⭐ Yo'lovchini baholang: /rate_passenger_${orderId}`,
        );
      } else {
        order.status = "passenger_confirmed";
        order.passengerConfirmedAt = new Date();
        await order.save();

        bot.sendMessage(
          chatId,
          `✅ Siz safar tugaganini tasdiqladingiz!\n\n⏳ Haydovchi tasdiqini kutmoqda...`,
        );

        bot.sendMessage(
          order.driverId,
          `👤 Yo'lovchi safar tugaganini bildirdi.\n\n📍 ${order.from} → ${order.to}\n\nSafar yakunlandimi?\n\n✅ Ha: /complete_${orderId}\n❌ Yo'q: /dispute_${orderId}`,
        );
      }
    } catch (err) {
      logger.error("Passenger confirm error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};

// ========== HELPER: BUYURTMA YARATISH ==========
async function createAndSendOrder(bot, chatId, session) {
  const Order = require("../models/Order.model");
  const assignOrder = require("./orderAssign");
  const Session = require("../models/session.model");
  const logger = require("../utils/logger");

  try {
    const orderData = {
      passengerId: chatId,
      from: session.data.from,
      to: session.data.to,
      orderType: session.data.orderType || "passenger",
    };

    if (session.data.orderType === "cargo") {
      orderData.cargoDescription =
        session.data.cargoDescription || "Ko'rsatilmagan";
    } else {
      orderData.passengers = session.data.passengerCount || 1;
    }

    const order = await Order.create(orderData);

    await Session.deleteMany({ telegramId: chatId });

    logger.info("Order yaratildi:", {
      orderId: order._id,
      passengerId: chatId,
      from: order.from,
      to: order.to,
      orderType: order.orderType,
    });

    const typeEmoji = order.orderType === "cargo" ? "📦" : "🚖";
    const typeText =
      order.orderType === "cargo"
        ? `Yuk: ${order.cargoDescription}`
        : `Yo'lovchilar: ${order.passengers} kishi`;

    await bot.sendMessage(
      chatId,
      `✅ Buyurtmangiz qabul qilindi!\n\n${typeEmoji} ${typeText}\n📍 ${order.from} ➝ ${order.to}\n\n⏳ Haydovchi izlanmoqda...`,
    );

    assignOrder(bot, order._id);
  } catch (err) {
    logger.error("createAndSendOrder error:", err);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
  }
}
