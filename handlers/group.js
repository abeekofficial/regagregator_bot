// ========== handlers/group.js ==========
const Group = require("../models/group.model");

module.exports = (bot) => {
  // Guruhga qo'shilganda
  bot.on("new_chat_members", async (msg) => {
    if (msg.new_chat_members.some(m => m.id === (await bot.getMe()).id)) {
      await Group.create({
        groupId: msg.chat.id,
        title: msg.chat.title,
        addedBy: msg.from.id
      });

      bot.sendMessage(msg.chat.id,
        "🚕 Taksi bot guruhga qo'shildi!\n\n" +
        "Buyurtmalar avtomatik shu yerga tushadi.\n" +
        "Qabul qilish uchun avval /start bosib ro'yxatdan o'ting!"
      );
    }
  });

  // Guruhda /start
  bot.onText(/\/start/, async (msg) => {
    if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
      const user = await User.findOne({ telegramId: msg.from.id });

      if (!user || !user.role) {
        return bot.sendMessage(msg.chat.id,
          `@${msg.from.username || msg.from.first_name}, ` +
          `ro'yxatdan o'tish uchun menga shaxsiy chatda /start bosing!`
        );
      }

      bot.sendMessage(msg.chat.id,
        `✅ @${msg.from.username} allaqachon ro'yxatdan o'tgan (${user.role})`
      );
    }
  });

  // Buyurtma guruhga tushishi
  async function sendOrderToGroups(bot, order) {
    const groups = await Group.find({ isActive: true });
    const passenger = await User.findOne({ telegramId: order.passengerId });

    for (const group of groups) {
      let message = `🚖 YANGI BUYURTMA!\n\n`;
      message += `📍 ${order.from} ➝ ${order.to}\n`;
      message += `👥 ${order.passengers} kishi\n`;
      message += `👤 ${passenger.name} - ${passenger.phone}\n`;
      message += `\nQabul qilish uchun tugmani bosing ⬇️`;

      bot.sendMessage(group.groupId, message, {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Qabul qilaman", callback_data: `group_accept_${order._id}` }
          ]]
        }
      });
    }
  }

  // Guruhda qabul qilish
  bot.on("callback_query", async (query) => {
    if (!query.data.startsWith("group_accept_")) return;

    const orderId = query.data.replace("group_accept_", "");
    const driver = await User.findOne({
      telegramId: query.from.id,
      role: "driver",
      isBlocked: false
    });

    if (!driver) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Siz haydovchi emas yoki bloklangansiz!",
        show_alert: true
      });
    }

    const order = await Order.findById(orderId);

    if (order.status !== "pending") {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Buyurtma allaqachon qabul qilingan",
        show_alert: true
      });
    }

    await Order.findByIdAndUpdate(orderId, {
      driverId: driver.telegramId,
      status: "accepted"
    });

    bot.editMessageText(
      query.message.text + `\n\n✅ QABUL QILDI: @${query.from.username}`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );

    // Passengerga xabar
    const passenger = await User.findOne({ telegramId: order.passengerId });

    if (driver.driverPhoto) {
      await bot.sendPhoto(passenger.telegramId, driver.driverPhoto, {
        caption: `🚗 Haydovchi topildi!\n${driver.name}\n${driver.phone}`
      });
    }
  });
};
