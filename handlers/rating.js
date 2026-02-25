// ========== handlers/rating.js ==========
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const logger = require("../utils/logger");
const showMainMenu = require("./menu");

module.exports = (bot) => {
  bot.onText(/⭐ Reytingim/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || user.role !== "driver") {
        return bot.sendMessage(chatId, "❌ Siz haydovchi emassiz!");
      }

      // ✅ Rating tahlili
      const rating = user.rating || 5.0;
      const totalRatings = user.totalRatings || 0;

      let ratingEmoji = "⭐";
      if (rating >= 4.8) ratingEmoji = "🌟";
      else if (rating >= 4.5) ratingEmoji = "⭐";
      else if (rating >= 4.0) ratingEmoji = "✨";
      else if (rating >= 3.5) ratingEmoji = "💫";
      else ratingEmoji = "⚠️";

      let message = `${ratingEmoji} REYTINGIM\n\n`;
      message += `👤 ${user.name}\n`;
      message += `⭐ Rating: ${rating.toFixed(1)} / 5.0\n`;
      message += `📊 Baholar soni: ${totalRatings} ta\n\n`;

      // ✅ Rating darajasi
      let level = "";
      if (rating >= 4.8) {
        level = "🌟 A'LO HAYDOVCHI";
      } else if (rating >= 4.5) {
        level = "⭐ YAXSHI HAYDOVCHI";
      } else if (rating >= 4.0) {
        level = "✨ O'RTACHA";
      } else if (rating >= 3.5) {
        level = "💫 YAXSHILASH KERAK";
      } else {
        level = "⚠️ PAST RATING";
      }

      message += `🏆 Daraja: ${level}\n\n`;

      // ✅ Tavsiyalar
      if (rating < 4.5) {
        message += `💡 TAVSIYALAR:\n`;
        message += `• Vaqtida keling\n`;
        message += `• Mashinani toza saqlang\n`;
        message += `• Xushmuomala bo'ling\n`;
        message += `• Xavfsiz haydang\n`;
      } else {
        message += `✅ Ajoyib! Davom eting!\n`;
      }

      bot.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Reytingim error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== DRIVER'NI BAHOLASH ==========
  bot.onText(/\/rate_driver_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];

    try {
      const order = await Order.findById(orderId);

      if (!order || order.passengerId !== chatId) {
        return bot.sendMessage(chatId, "❌ Bu sizning buyurtmangiz emas!");
      }

      if (order.status !== "completed") {
        return bot.sendMessage(chatId, "❌ Buyurtma hali yakunlanmagan!");
      }

      // ✅ Rating tanlash tugmalari
      bot.sendMessage(
        chatId,
        "⭐ Haydovchini baholang:\n\n5 - A'lo\n4 - Yaxshi\n3 - O'rtacha\n2 - Yomon\n1 - Juda yomon",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⭐⭐⭐⭐⭐ 5", callback_data: `rating_${orderId}_5` },
                { text: "⭐⭐⭐⭐ 4", callback_data: `rating_${orderId}_4` },
              ],
              [
                { text: "⭐⭐⭐ 3", callback_data: `rating_${orderId}_3` },
                { text: "⭐⭐ 2", callback_data: `rating_${orderId}_2` },
                { text: "⭐ 1", callback_data: `rating_${orderId}_1` },
              ],
            ],
          },
        },
      );
    } catch (err) {
      logger.error("Rate driver error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== PASSENGER'NI BAHOLASH ==========
  bot.onText(/\/rate_passenger_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];

    try {
      const order = await Order.findById(orderId);

      if (!order || order.driverId !== chatId) {
        return bot.sendMessage(chatId, "❌ Bu sizning buyurtmangiz emas!");
      }

      if (order.status !== "completed") {
        return bot.sendMessage(chatId, "❌ Buyurtma hali yakunlanmagan!");
      }

      bot.sendMessage(
        chatId,
        "⭐ Yo'lovchini baholang:\n\n5 - A'lo\n4 - Yaxshi\n3 - O'rtacha\n2 - Yomon\n1 - Juda yomon",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⭐⭐⭐⭐⭐ 5",
                  callback_data: `rating_p_${orderId}_5`,
                },
                { text: "⭐⭐⭐⭐ 4", callback_data: `rating_p_${orderId}_4` },
              ],
              [
                { text: "⭐⭐⭐ 3", callback_data: `rating_p_${orderId}_3` },
                { text: "⭐⭐ 2", callback_data: `rating_p_${orderId}_2` },
                { text: "⭐ 1", callback_data: `rating_p_${orderId}_1` },
              ],
            ],
          },
        },
      );
    } catch (err) {
      logger.error("Rate passenger error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== RATING CALLBACK ==========
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      // Driver rating
      if (data.startsWith("rating_") && !data.startsWith("rating_p_")) {
        const parts = data.split("_");
        const orderId = parts[1];
        const rating = parseInt(parts[2]);

        const order = await Order.findById(orderId);

        if (!order || order.passengerId !== chatId) {
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Xato!",
            show_alert: true,
          });
        }

        // ✅ Driver rating'ini yangilash
        const driver = await User.findOne({ telegramId: order.driverId });

        if (driver) {
          const oldTotal = driver.rating * (driver.totalRatings || 0);
          const newTotal = oldTotal + rating;
          const newCount = (driver.totalRatings || 0) + 1;
          const newRating = newTotal / newCount;

          await User.findOneAndUpdate(
            { telegramId: order.driverId },
            {
              $set: {
                rating: newRating,
                totalRatings: newCount,
              },
            },
          );

          await bot.answerCallbackQuery(query.id, {
            text: `✅ ${rating} yulduz berildi!`,
            show_alert: false,
          });

          bot.editMessageText(
            `✅ Haydovchiga ${rating} yulduz berdingiz!\n\nRahmat!`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
            },
          );
        }
      }

      // Passenger rating
      if (data.startsWith("rating_p_")) {
        const parts = data.split("_");
        const orderId = parts[2];
        const rating = parseInt(parts[3]);

        await bot.answerCallbackQuery(query.id, {
          text: `✅ ${rating} yulduz berildi!`,
          show_alert: false,
        });

        bot.editMessageText(
          `✅ Yo'lovchiga ${rating} yulduz berdingiz!\n\nRahmat!`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
          },
        );
        return showMainMenu();
      }
    } catch (err) {
      logger.error("Rating callback error:", err);
    }
  });
};
