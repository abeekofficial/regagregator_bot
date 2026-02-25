// ========== handlers/history.js ==========
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const logger = require("../utils/logger");

module.exports = (bot) => {
  bot.onText(/📊 Tarixim/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || user.role !== "passenger") {
        return bot.sendMessage(chatId, "❌ Siz yo'lovchi emassiz!");
      }

      // ✅ Oxirgi 10 ta buyurtma
      const orders = await Order.find({
        passengerId: chatId,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      if (orders.length === 0) {
        return bot.sendMessage(
          chatId,
          "📊 Sizda hali buyurtmalar yo'q.\n\n🚖 Birinchi buyurtma bering!",
        );
      }

      let message = `📊 TARIXIM (oxirgi ${orders.length} ta)\n\n`;

      orders.forEach((order, index) => {
        const statusEmoji = {
          pending: "⏳",
          accepted: "✅",
          in_progress: "🚕",
          driver_confirmed: "⏳",
          passenger_confirmed: "⏳",
          completed: "✅",
          cancelled: "❌",
        };

        const statusText = {
          pending: "Kutilmoqda",
          accepted: "Qabul qilindi",
          in_progress: "Jarayonda",
          driver_confirmed: "Driver tasdiqladi",
          passenger_confirmed: "Siz tasdiqladingiz",
          completed: "Yakunlandi",
          cancelled: "Bekor qilindi",
        };

        message += `${index + 1}. ${statusEmoji[order.status] || "📦"} ${order.from} → ${order.to}\n`;
        message += `   Status: ${statusText[order.status]}\n`;
        message += `   Sana: ${order.createdAt.toLocaleDateString("uz-UZ")}\n`;

        if (order.status === "completed" && order.completedAt) {
          message += `   Yakunlandi: ${order.completedAt.toLocaleDateString("uz-UZ")}\n`;
        }

        message += `\n`;
      });

      message += `\n💡 Umumiy buyurtmalar: ${orders.length} ta`;

      bot.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Tarixim error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};
