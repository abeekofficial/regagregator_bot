// ========== handlers/admin.js (TO'LIQ) ==========
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const Group = require("../models/group.model");

module.exports = (bot) => {
  // Admin login
  bot.onText(/\/admin/, async (msg) => {
    if (!config.ADMIN_IDS.includes(msg.chat.id)) return;

    bot.sendMessage(msg.chat.id, "👑 ADMIN PANEL", {
      reply_markup: {
        keyboard: [
          ["📊 Statistika", "👥 Foydalanuvchilar"],
          ["🚫 Bloklangan", "💬 Guruhlar"],
          ["📈 Hisobotlar", "🔧 Sozlamalar"],
        ],
        resize_keyboard: true,
      },
    });
  });

  // 📊 Statistika
  bot.onText(/📊 Statistika/, async (msg) => {
    if (!config.ADMIN_IDS.includes(msg.chat.id)) return;

    const stats = {
      totalUsers: await User.countDocuments(),
      passengers: await User.countDocuments({ role: "passenger" }),
      drivers: await User.countDocuments({ role: "driver" }),
      blockedUsers: await User.countDocuments({ isBlocked: true }),

      totalOrders: await Order.countDocuments(),
      pendingOrders: await Order.countDocuments({ status: "pending" }),
      completedOrders: await Order.countDocuments({ status: "completed" }),
      cancelledOrders: await Order.countDocuments({ status: "cancelled" }),

      totalGroups: await Group.countDocuments({ isActive: true }),

      todayUsers: await User.countDocuments({
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) },
      }),
      todayOrders: await Order.countDocuments({
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) },
      }),
    };

    let message = `📊 STATISTIKA\n\n`;
    message += `👥 Jami foydalanuvchilar: ${stats.totalUsers}\n`;
    message += `   • Yo'lovchilar: ${stats.passengers}\n`;
    message += `   • Haydovchilar: ${stats.drivers}\n`;
    message += `   • Bloklangan: ${stats.blockedUsers}\n\n`;

    message += `📦 Buyurtmalar:\n`;
    message += `   • Jami: ${stats.totalOrders}\n`;
    message += `   • Kutilmoqda: ${stats.pendingOrders}\n`;
    message += `   • Bajarilgan: ${stats.completedOrders}\n`;
    message += `   • Bekor qilingan: ${stats.cancelledOrders}\n\n`;

    message += `💬 Guruhlar: ${stats.totalGroups}\n\n`;

    message += `📅 BUGUN:\n`;
    message += `   • Yangi userlar: ${stats.todayUsers}\n`;
    message += `   • Yangi buyurtmalar: ${stats.todayOrders}`;

    bot.sendMessage(msg.chat.id, message);
  });

  // 👥 Foydalanuvchilar
  bot.onText(/👥 Foydalanuvchilar/, async (msg) => {
    if (!config.ADMIN_IDS.includes(msg.chat.id)) return;

    bot.sendMessage(msg.chat.id, "Qidirish turi:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔍 ID bo'yicha", callback_data: "search_by_id" },
            { text: "📱 Telefon", callback_data: "search_by_phone" },
          ],
          [
            { text: "🚕 Eng faol haydovchilar", callback_data: "top_drivers" },
            {
              text: "🧍 Eng faol yo'lovchilar",
              callback_data: "top_passengers",
            },
          ],
        ],
      },
    });
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === "top_drivers") {
      const drivers = await User.find({ role: "driver" })
        .sort({ completedOrders: -1, rating: -1 })
        .limit(10);

      let message = `🏆 TOP 10 HAYDOVCHILAR:\n\n`;
      drivers.forEach((d, i) => {
        message += `${i + 1}. ${d.name}\n`;
        message += `   ID: ${d.telegramId}\n`;
        message += `   ⭐ ${d.rating.toFixed(1)} | 📦 ${d.completedOrders} buyurtma\n`;
        message += `   📊 Referal: ${d.referralCount}\n\n`;
      });

      bot.sendMessage(chatId, message);
    }

    if (query.data === "search_by_id") {
      const session = await Session.create({
        telegramId: chatId,
        step: "ADMIN_SEARCH_ID",
      });

      bot.sendMessage(chatId, "🔍 User ID ni kiriting:");
    }
  });

  // 🚫 Bloklash/Ochish
  bot.onText(/\/block (\d+)/, async (msg, match) => {
    if (!config.ADMIN_IDS.includes(msg.chat.id)) return;

    const userId = parseInt(match[1]);

    await User.findOneAndUpdate(
      { telegramId: userId },
      {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: "Admin tomonidan",
      },
    );

    bot.sendMessage(msg.chat.id, `✅ User ${userId} bloklandi`);
    bot.sendMessage(
      userId,
      "🚫 Siz administrator tomonidan bloklandingiz.\n" +
        "Sabab: Qoidalarni buzish\n\n" +
        "Murojaat: @admin",
    );
  });

  bot.onText(/\/unblock (\d+)/, async (msg, match) => {
    if (!config.ADMIN_IDS.includes(msg.chat.id)) return;

    const userId = parseInt(match[1]);

    await User.findOneAndUpdate(
      { telegramId: userId },
      {
        isBlocked: false,
        blockedReason: null,
      },
    );

    bot.sendMessage(msg.chat.id, `✅ User ${userId} blokdan chiqarildi`);
    bot.sendMessage(userId, "✅ Sizning blokirovkangiz olib tashlandi!");
  });

  // 💬 Guruhlar ro'yxati
  bot.onText(/💬 Guruhlar/, async (msg) => {
    if (!config.ADMIN_IDS.includes(msg.chat.id)) return;

    const groups = await Group.find({ isActive: true });

    let message = `💬 GURUHLAR (${groups.length}ta):\n\n`;

    for (const g of groups) {
      message += `📌 ${g.title}\n`;
      message += `   ID: ${g.groupId}\n`;
      message += `   Buyurtmalar: ${g.totalOrders}\n`;
      message += `   Qo'shilgan: ${g.createdAt.toLocaleDateString()}\n\n`;
    }

    bot.sendMessage(msg.chat.id, message);
  });
};
