const state = require("../utils/state");
const Order = require("../models/Order.model"); // model nomi kichik harf bo'lsin
const { createInlineKeyboard } = require("../utils/regionOptions");

module.exports = (bot) => {
  // 1️⃣ FROM region
  bot.onText(/🚖 Buyurtma berish/, async (msg) => {
    const chatId = msg.chat.id;
    state.set(chatId, { step: "FROM_REGION" });

    bot.sendMessage(
      chatId,
      "📍 Qayerdan yo‘lga chiqasiz?",
      createInlineKeyboard(),
    );
  });

  // 2️⃣ CALLBACK QUERY (FROM va TO)
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (!state.get(chatId)) return; // agar step bo‘lmasa return
    const userState = state.get(chatId);

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

        // Orderni saqlaymiz
        await Order.create({
          passengerId: chatId,
          from: userState.from,
          to: userState.to,
        });

        state.clear(chatId);

        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(
          chatId,
          `✅ Buyurtmangiz qabul qilindi!\n${userState.from} ➝ ${userState.to}`,
        );
      }
    }
  });
};
