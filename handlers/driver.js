// ========== handlers/driver.js (TO'LIQ YANGILANGAN) ==========
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const logger = require("../utils/logger");

module.exports = (bot) => {
  // ========== 1️⃣ BUYURTMALAR TUGMASI ==========
  bot.onText(/📋 Buyurtmalar/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || user.role !== "driver") {
        return bot.sendMessage(chatId, "❌ Siz haydovchi emassiz!");
      }

      bot.sendMessage(chatId, "📋 Qaysi buyurtmalarni ko'rmoqchisiz?", {
        reply_markup: {
          keyboard: [
            ["🚗 Mening buyurtmalarim"],
            ["🌍 Barcha buyurtmalar"],
            ["⬅️ Bosh menuga qaytish"],
          ],
          resize_keyboard: true,
        },
      });
    } catch (err) {
      logger.error("Buyurtmalar menu error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== 2️⃣ MENING BUYURTMALARIM ==========
  bot.onText(/🚗 Mening buyurtmalarim/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || user.role !== "driver") {
        return bot.sendMessage(chatId, "❌ Siz haydovchi emassiz!");
      }

      const orders = await Order.find({
        driverId: chatId,
        status: { $in: ["accepted", "in_progress", "driver_confirmed"] },
      }).sort({ createdAt: -1 });

      if (orders.length === 0) {
        return bot.sendMessage(chatId, "❌ Sizda faol buyurtmalar yo'q", {
          reply_markup: {
            keyboard: [
              ["📋 Buyurtmalar"],
              ["👤 Profilim", "📊 Statistika"],
              ["⭐ Reytingim"],
            ],
            resize_keyboard: true,
          },
        });
      }

      let message = `🚗 MENING BUYURTMALARIM (${orders.length} ta):\n\n`;

      orders.forEach((order, index) => {
        const statusEmoji = {
          accepted: "✅",
          in_progress: "🚕",
          driver_confirmed: "⏳",
        };
        const typeIcon = order.orderType === "cargo" ? "📦" : "👥";

        message += `${index + 1}. ${statusEmoji[order.status] || "📦"} `;
        message += `${order.from} → ${order.to}\n`;
        message += `   ${typeIcon} `;
        if (order.orderType === "cargo") {
          message += `Yuk: ${order.cargoDescription || "-"}\n`;
        } else {
          message += `${order.passengers || 1} kishi\n`;
        }
        message += `   Status: ${getStatusText(order.status)}\n`;
        message += `   ID: ${order._id.toString().slice(-6)}\n\n`;
      });

      bot.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Mening buyurtmalarim error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== 3️⃣ BARCHA BUYURTMALAR ==========
  bot.onText(/🌍 Barcha buyurtmalar/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || user.role !== "driver") {
        return bot.sendMessage(chatId, "❌ Siz haydovchi emassiz!");
      }

      const orders = await Order.find({
        status: "pending",
        driverId: null,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      if (orders.length === 0) {
        return bot.sendMessage(chatId, `❌ Hozircha buyurtmalar yo'q`, {
          reply_markup: {
            keyboard: [
              ["📋 Buyurtmalar"],
              ["👤 Profilim", "📊 Statistika"],
              ["⭐ Reytingim"],
            ],
            resize_keyboard: true,
          },
        });
      }

      for (const order of orders) {
        const typeIcon = order.orderType === "cargo" ? "📦" : "👥";
        const typeText =
          order.orderType === "cargo"
            ? `Yuk: ${order.cargoDescription}`
            : `Yo'lovchilar: ${order.passengers || 1} kishi`;

        const message =
          `📍 ${order.from} → ${order.to}\n` +
          `${typeIcon} ${typeText}\n` +
          `🕐 ${order.createdAt ? new Date(order.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "Hozir"}\n` +
          `📝 ID: ${order._id.toString().slice(-6)}`;

        await bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "▶️ Qabul qilish",
                  callback_data: `accept_${order._id}`,
                },
                { text: "❌ Rad etish", callback_data: `reject_${order._id}` },
              ],
            ],
          },
        });
      }
    } catch (err) {
      logger.error("Barcha buyurtmalar error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== 4️⃣ CALLBACK QUERY HANDLER ==========
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Faqat shaxsiy chatda ishlaydi
    if (query.message.chat.type !== "private") return;

    try {
      // ========== SAFAR BOSHLASH ==========
      if (data.startsWith("start_trip_")) {
        const orderId = data.replace("start_trip_", "");
        const order = await Order.findById(orderId);

        if (!order || order.driverId !== chatId) {
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Bu sizning buyurtmangiz emas!",
            show_alert: true,
          });
        }

        if (order.status !== "accepted") {
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Buyurtma holati noto'g'ri!",
            show_alert: true,
          });
        }

        order.status = "in_progress";
        order.startedAt = new Date();
        await order.save();

        await bot.answerCallbackQuery(query.id, {
          text: "✅ Safar boshlandi!",
        });

        await bot.editMessageText(
          `🚕 SAFAR BOSHLANDI!\n\n📍 ${order.from} → ${order.to}\n\nYaxshi yo'l!`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Safar yakunlandi",
                    callback_data: `complete_order_${orderId}`,
                  },
                ],
              ],
            },
          },
        );

        bot.sendMessage(
          order.passengerId,
          `🚕 Safar boshlandi!\n\n📍 ${order.from} → ${order.to}\n\nYaxshi yo'l!`,
        );

        logger.info(`Safar boshlandi: ${orderId}`);
      }

      // ========== SAFAR YAKUNLASH (Driver) ==========
      if (data.startsWith("complete_order_")) {
        const orderId = data.replace("complete_order_", "");
        const order = await Order.findById(orderId);

        if (!order || order.driverId !== chatId) {
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

        if (order.status === "passenger_confirmed") {
          // Ikki tomon ham tasdiqladi — yakunlash
          order.status = "completed";
          order.completedAt = new Date();
          await order.save();

          await User.findOneAndUpdate(
            { telegramId: chatId },
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
            `⭐ Yo'lovchini baholang: /rate_passenger_${orderId}`,
          );

          bot.sendMessage(
            order.passengerId,
            `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\n⭐ Haydovchini baholang: /rate_driver_${orderId}`,
          );

          logger.info(`Safar yakunlandi: ${orderId}`);
        } else {
          // Driver birinchi tasdiqladi
          order.status = "driver_confirmed";
          order.driverConfirmedAt = new Date();
          await order.save();

          await bot.answerCallbackQuery(query.id, {
            text: "✅ Siz tasdiqladingiz! Yo'lovchi tasdiqini kutmoqda...",
          });

          await bot.editMessageText(
            `✅ Siz safar tugaganini tasdiqladingiz!\n\n⏳ Yo'lovchi tasdiqini kutmoqda...`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: { inline_keyboard: [] },
            },
          );

          bot.sendMessage(
            order.passengerId,
            `🚗 Haydovchi safar tugaganini bildirdi.\n\n📍 ${order.from} → ${order.to}\n\nSafar yakunlandimi?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Ha, yakunlandi",
                      callback_data: `confirm_complete_btn_${orderId}`,
                    },
                    { text: "❌ Yo'q", callback_data: `dispute_${orderId}` },
                  ],
                ],
              },
            },
          );

          logger.info(`Driver tasdiqladi, passenger kutmoqda: ${orderId}`);
        }
      }
    } catch (err) {
      logger.error("Driver callback error:", err);
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

  // ========== 5️⃣ SAFAR BOSHLASH (Text command) ==========
  bot.onText(/\/start_trip_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];

    try {
      const order = await Order.findById(orderId);

      if (!order || order.driverId !== chatId) {
        return bot.sendMessage(chatId, "❌ Bu sizning buyurtmangiz emas!");
      }

      if (order.status !== "accepted") {
        return bot.sendMessage(chatId, "❌ Buyurtma holati noto'g'ri!");
      }

      order.status = "in_progress";
      order.startedAt = new Date();
      await order.save();

      bot.sendMessage(
        chatId,
        `🚕 SAFAR BOSHLANDI!\n\n📍 ${order.from} → ${order.to}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Safar yakunlandi",
                  callback_data: `complete_order_${orderId}`,
                },
              ],
            ],
          },
        },
      );

      bot.sendMessage(
        order.passengerId,
        `🚕 Safar boshlandi!\n\n📍 ${order.from} → ${order.to}\n\nYaxshi yo'l!`,
      );
    } catch (err) {
      logger.error("Start trip error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== 6️⃣ SAFAR YAKUNLASH (Text command) ==========
  bot.onText(/\/complete_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];

    try {
      const order = await Order.findById(orderId);

      if (!order || order.driverId !== chatId) {
        return bot.sendMessage(chatId, "❌ Bu sizning buyurtmangiz emas!");
      }

      if (order.status === "completed") {
        return bot.sendMessage(
          chatId,
          "✅ Bu buyurtma allaqachon yakunlangan!",
        );
      }

      if (order.status === "passenger_confirmed") {
        order.status = "completed";
        order.completedAt = new Date();
        await order.save();

        await User.findOneAndUpdate(
          { telegramId: chatId },
          { $inc: { completedOrders: 1 } },
        );

        bot.sendMessage(
          chatId,
          `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\n⭐ Yo'lovchini baholang: /rate_passenger_${orderId}`,
        );

        bot.sendMessage(
          order.passengerId,
          `✅ SAFAR YAKUNLANDI!\n\n📍 ${order.from} → ${order.to}\n\n⭐ Haydovchini baholang: /rate_driver_${orderId}`,
        );
      } else {
        order.status = "driver_confirmed";
        order.driverConfirmedAt = new Date();
        await order.save();

        bot.sendMessage(
          chatId,
          `✅ Siz safar tugaganini tasdiqladingiz!\n\n⏳ Yo'lovchi tasdiqini kutmoqda...`,
        );

        bot.sendMessage(
          order.passengerId,
          `🚗 Haydovchi safar tugaganini bildirdi.\n\n📍 ${order.from} → ${order.to}\n\nSafar yakunlandimi?\n\n✅ Ha: /confirm_complete_${orderId}\n❌ Yo'q: /dispute_${orderId}`,
        );
      }
    } catch (err) {
      logger.error("Complete order error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};

// ========== HELPER FUNCTIONS ==========
function getStatusText(status) {
  const statuses = {
    pending: "Kutilmoqda",
    accepted: "Qabul qilindi",
    in_progress: "Jarayonda",
    driver_confirmed: "Driver tasdiqladi",
    passenger_confirmed: "Yo'lovchi tasdiqladi",
    completed: "Yakunlandi",
    cancelled: "Bekor qilindi",
  };
  return statuses[status] || status;
}
