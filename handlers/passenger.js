// ==================== handlers/passenger.js (TO'LIQ YANGILANGAN) ====================
const state = require("../utils/state");
const Order = require("../models/Order.model");
const { createInlineKeyboard } = require("../utils/regionOptions");
const assignOrder = require("./orderAssign");

module.exports = (bot) => {
  // 1️⃣ Buyurtma berish boshlash
  bot.onText(/🚖 Buyurtma berish/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      state.set(chatId, { step: "FROM_REGION", role: "order" });

      bot.sendMessage(
        chatId,
        "📍 Qayerdan yo'lga chiqasiz?",
        createInlineKeyboard(),
      );
    } catch (err) {
      console.error("Buyurtma berish error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // 2️⃣ CALLBACK QUERY handler
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      const userState = state.get(chatId);
      if (!userState || userState.role !== "order") return;

      if (data.startsWith("region_")) {
        const regionCode = data.replace("region_", "");

        // FROM tanlandi
        if (userState.step === "FROM_REGION") {
          userState.from = regionCode;
          userState.step = "TO_REGION";
          state.set(chatId, userState);

          await bot.answerCallbackQuery(query.id);
          return bot.sendMessage(
            chatId,
            "📍 Qayerga borasiz?",
            createInlineKeyboard(),
          );
        }

        // TO tanlandi
        if (userState.step === "TO_REGION") {
          userState.to = regionCode;

          // ✅ Order yaratish (try-catch ichida)
          try {
            const order = await Order.create({
              passengerId: chatId,
              from: userState.from,
              to: userState.to,
            });

            state.clear(chatId);

            await bot.answerCallbackQuery(query.id);
            await bot.sendMessage(
              chatId,
              `✅ Buyurtmangiz qabul qilindi!\n📍 ${userState.from} ➝ ${userState.to}\n\n⏳ Haydovchi izlanmoqda...`,
            );

            // Order assign qilish
            assignOrder(bot, order._id);
          } catch (err) {
            console.error("Order creation error:", err);
            bot.sendMessage(
              chatId,
              "❌ Xatolik yuz berdi, qayta urinib ko'ring",
            );
          }
        }
      }
    } catch (err) {
      console.error("Passenger callback error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};
