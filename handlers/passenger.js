// ==================== handlers/passenger.js (TO'LIQ YANGILANGAN) ====================
const state = require("../utils/state");
const Order = require("../models/Order.model");
const User = require("../models/user.model");
const { createInlineKeyboard } = require("../utils/regionOptions");
const assignOrder = require("./orderAssign");

module.exports = (bot) => {
  // 1️⃣ Buyurtma berish boshlash
  bot.onText(/🚖 Buyurtma berish/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      state.set(chatId, { step: "ORDER_TYPE", role: "order" });

      bot.sendMessage(chatId, "📦 Buyurtma turini tanlang:", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "👥 Yo'lovchi tashish",
                callback_data: "order_passenger",
              },
              { text: "📦 Yuk tashish", callback_data: "order_cargo" },
            ],
          ],
        },
      });
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

      // Buyurtma turini tanlash
      if (data === "order_passenger") {
        userState.orderType = "passenger";
        userState.step = "PASSENGER_COUNT";
        state.set(chatId, userState);

        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(
          chatId,
          "👥 Necha kishi ketasiz?\n(Masalan: 1, 2, 3, 4)",
        );
      }

      if (data === "order_cargo") {
        userState.orderType = "cargo";
        userState.step = "CARGO_WEIGHT";
        state.set(chatId, userState);

        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(
          chatId,
          "⚖️ Yuk og'irligini kiriting (kg da):\n(Masalan: 50, 100, 200)",
        );
      }

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

          // ✅ Order yaratish
          try {
            const orderData = {
              passengerId: chatId,
              from: userState.from,
              to: userState.to,
              orderType: userState.orderType,
            };

            if (userState.orderType === "passenger") {
              orderData.passengers = userState.passengerCount;
            } else if (userState.orderType === "cargo") {
              orderData.cargoWeight = userState.cargoWeight;
            }

            const order = await Order.create(orderData);

            state.clear(chatId);

            await bot.answerCallbackQuery(query.id);

            let orderInfo = `✅ Buyurtmangiz qabul qilindi!\n\n`;
            orderInfo += `📍 ${userState.from} ➝ ${userState.to}\n`;

            if (userState.orderType === "passenger") {
              orderInfo += `👥 Yo'lovchilar: ${userState.passengerCount} kishi\n`;
            } else {
              orderInfo += `⚖️ Yuk og'irligi: ${userState.cargoWeight} kg\n`;
            }

            orderInfo += `\n⏳ Haydovchi izlanmoqda...`;

            await bot.sendMessage(chatId, orderInfo);

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

  // 3️⃣ TEXT HANDLER - yo'lovchilar soni va yuk og'irligi uchun
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    try {
      const userState = state.get(chatId);
      if (!userState || userState.role !== "order") return;

      // ✅ Yo'lovchilar sonini kiritish
      if (userState.step === "PASSENGER_COUNT") {
        const count = parseInt(text);
        if (isNaN(count) || count < 1 || count > 10) {
          return bot.sendMessage(
            chatId,
            "❌ Noto'g'ri son! 1 dan 10 gacha son kiriting:",
          );
        }

        userState.passengerCount = count;
        userState.step = "FROM_REGION";
        state.set(chatId, userState);

        return bot.sendMessage(
          chatId,
          "📍 Qayerdan yo'lga chiqasiz?",
          createInlineKeyboard(),
        );
      }

      // ✅ Yuk og'irligini kiritish
      if (userState.step === "CARGO_WEIGHT") {
        const weight = parseFloat(text);
        if (isNaN(weight) || weight < 1 || weight > 10000) {
          return bot.sendMessage(
            chatId,
            "❌ Noto'g'ri og'irlik! 1 dan 10000 kg gacha kiriting:",
          );
        }

        userState.cargoWeight = weight;
        userState.step = "FROM_REGION";
        state.set(chatId, userState);

        return bot.sendMessage(
          chatId,
          "📍 Qayerdan yuborasiz?",
          createInlineKeyboard(),
        );
      }
    } catch (err) {
      console.error("Passenger message error:", err);
    }
  });
};
