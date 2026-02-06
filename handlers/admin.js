// ==================== handlers/admin.js ====================
const Order = require("../models/Order.model");
const User = require("../models/user.model");
const isAdmin = require("../utils/isAdmin");

module.exports = (bot) => {
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      bot.sendMessage(chatId, "👑 Admin panel", {
        reply_markup: {
          keyboard: [["📊 Statistika"], ["🚫 Haydovchini bloklash"]],
          resize_keyboard: true,
        },
      });
    } catch (err) {
      console.error("Admin panel error:", err);
    }
  });

  bot.onText(/📊 Statistika/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const users = await User.countDocuments();
      const orders = await Order.countDocuments();
      const activeOrders = await Order.countDocuments({ status: "pending" });
      const completedOrders = await Order.countDocuments({
        status: "completed",
      });

      bot.sendMessage(
        chatId,
        `📊 STATISTIKA\n\n👥 Foydalanuvchilar: ${users}\n📦 Jami buyurtmalar: ${orders}\n⏳ Kutilmoqda: ${activeOrders}\n✅ Bajarilgan: ${completedOrders}`,
      );
    } catch (err) {
      console.error("Statistika error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });
};
