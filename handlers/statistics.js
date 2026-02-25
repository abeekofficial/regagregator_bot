// ========== handlers/statistics.js ==========
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const logger = require("../utils/logger");

module.exports = (bot) => {
  bot.onText(/📊 Statistika/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await User.findOne({ telegramId: chatId });

      if (!user || user.role !== "driver") {
        return bot.sendMessage(chatId, "❌ Siz haydovchi emassiz!");
      }

      // ✅ Driver statistikasi
      const totalOrders = await Order.countDocuments({
        driverId: chatId,
        status: "completed",
      });

      const inProgressOrders = await Order.countDocuments({
        driverId: chatId,
        status: { $in: ["accepted", "in_progress"] },
      });

      const cancelledOrders = await Order.countDocuments({
        driverId: chatId,
        status: "cancelled",
      });

      // ✅ Bu oyning statistikasi
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyOrders = await Order.countDocuments({
        driverId: chatId,
        status: "completed",
        completedAt: { $gte: startOfMonth },
      });

      let message = `📊 STATISTIKA\n\n`;
      message += `👤 ${user.name}\n`;
      message += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n`;
      message += `📈 Priority: ${user.referralCount || 0} (${user.referralCount > 10 ? "Yuqori" : "O'rta"})\n\n`;

      message += `📦 BUYURTMALAR:\n`;
      message += `✅ Yakunlangan: ${totalOrders} ta\n`;
      message += `🚕 Jarayonda: ${inProgressOrders} ta\n`;
      message += `❌ Bekor qilingan: ${cancelledOrders} ta\n\n`;

      message += `📅 BU OY:\n`;
      message += `✅ Yakunlangan: ${monthlyOrders} ta\n\n`;

      message += `👥 REFERAL:\n`;
      message += `Taklif qilganlar: ${user.referralCount || 0} ta\n`;

      bot.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Statistika error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};
