const Order = require("../models/Order.model");
const User = require("../models/user.model");
const isAdmin = require("../utils/isAdmin");

module.exports = (bot) => {
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    bot.sendMessage(chatId, "👑 Admin panel", {
      reply_markup: {
        keyboard: [["📊 Statistika"], ["🚫 Haydovchini bloklash"]],
        resize_keyboard: true,
      },
    });
  });

  bot.onText(/📊 Statistika/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const users = await User.countDocuments();
    const orders = await Order.countDocuments();

    bot.sendMessage(
      chatId,
      `📊 STATISTIKA\n\n👥 Foydalanuvchilar: ${users}\n📦 Buyurtmalar: ${orders}`,
    );
  });
};
