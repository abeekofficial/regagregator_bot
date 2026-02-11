// ========== handlers/group.js (FAQAT BUYURTMALARNI KO'RSATISH) ==========
const Group = require("../models/group.model");
const User = require("../models/user.model");
const Order = require("../models/Order.model");

module.exports = (bot) => {
  // ========== GURUHGA QO'SHILGANDA ==========
  bot.on("new_chat_members", async (msg) => {
    try {
      const botInfo = await bot.getMe();
      const isBotAdded = msg.new_chat_members.some((m) => m.id === botInfo.id);

      if (!isBotAdded) return;

      // Guruh mavjudligini tekshirish
      const existingGroup = await Group.findOne({ groupId: msg.chat.id });

      if (!existingGroup) {
        await Group.create({
          groupId: msg.chat.id,
          title: msg.chat.title,
          type: msg.chat.type,
          addedBy: msg.from.id,
        });

        console.log(`✅ Yangi guruh qo'shildi: ${msg.chat.title}`);
      }

      const botUsername = botInfo.username;

      bot.sendMessage(
        msg.chat.id,
        `🚕 Taksi bot guruhga qo'shildi!\n\n` +
          `✅ Bu guruhda buyurtmalar avtomatik ravishda paydo bo'ladi.\n\n` +
          `⚠️ MUHIM:\n` +
          `• Buyurtmalarni qabul qilish uchun avval botga shaxsiy chatda kirish kerak\n` +
          `• Guruhda buyurtma berish mumkin EMAS\n` +
          `• Faqat ro'yxatdan o'tgan haydovchilar buyurtma qabul qilishi mumkin\n\n` +
          `📱 Botga o'tish: @${botUsername}\n` +
          `👉 Shaxsiy chatda /start bosing`,
      );
    } catch (err) {
      console.error("Guruhga qo'shilish xatosi:", err);
    }
  });

  // ========== GURUHDA BARCHA XABARLARNI BLOKLASH ==========
  bot.on("message", async (msg) => {
    // Faqat guruhlar uchun
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
      return; // Shaxsiy chatda oddiy ishlaydi
    }

    // Bot qo'shilish xabari bo'lsa - o'tkazib yuborish
    if (msg.new_chat_members) return;

    // Agar buyurtma callback'i bo'lmasa - xabar yuborish
    if (msg.text && !msg.text.startsWith("/")) {
      try {
        const botInfo = await bot.getMe();

        // Faqat bitta marta eslatma
        await bot.sendMessage(
          msg.chat.id,
          `⚠️ Bu guruhda faqat buyurtmalar ko'rinadi.\n\n` +
            `📱 Taksi chaqirish yoki haydovchi bo'lish uchun:\n` +
            `👉 @${botInfo.username} ga shaxsiy chatda /start bosing`,
          {
            reply_to_message_id: msg.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🚕 Botga o'tish",
                    url: `https://t.me/${botInfo.username}?start=group_${msg.chat.id}`,
                  },
                ],
              ],
            },
          },
        );
      } catch (err) {
        console.error("Guruh message handler error:", err);
      }
    }
  });

  // ========== BUYURTMANI GURUHLARGA YUBORISH ==========
  async function sendOrderToGroups(bot, order) {
    try {
      const groups = await Group.find({ isActive: true });
      const passenger = await User.findOne({ telegramId: order.passengerId });

      if (!passenger) {
        console.error("Passenger topilmadi:", order.passengerId);
        return;
      }

      console.log(`📤 Buyurtma ${groups.length} ta guruhga yuborilmoqda...`);

      const botInfo = await bot.getMe();

      for (const group of groups) {
        try {
          let message = `🚖 YANGI BUYURTMA!\n\n`;
          message += `📍 ${order.from} ➝ ${order.to}\n`;

          if (order.orderType === "passenger") {
            message += `👥 Yo'lovchilar: ${order.passengers} kishi\n`;
          } else {
            message += `📦 Yuk: ${order.cargoWeight} kg\n`;
          }

          message += `\n👤 Buyurtmachi: ${passenger.name}\n`;
          message += `📱 Telefon: ${passenger.phone}\n`;
          if (passenger.username) {
            message += `Telegram: @${passenger.username}\n`;
          }
          message += `\n⏰ ${new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`;

          await bot.sendMessage(group.groupId, message, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Qabul qilaman",
                    callback_data: `group_accept_${order._id}`,
                  },
                ],
                [
                  {
                    text: "🚕 Botga o'tish",
                    url: `https://t.me/${botInfo.username}?start=order_${order._id}`,
                  },
                ],
              ],
            },
          });

          // Guruh statistikasini yangilash
          await Group.findOneAndUpdate(
            { groupId: group.groupId },
            {
              $inc: { totalOrders: 1 },
              lastActivity: new Date(),
            },
          );

          console.log(`✅ Guruhga yuborildi: ${group.title}`);
        } catch (err) {
          console.error(
            `❌ Guruhga yuborishda xato (${group.title}):`,
            err.message,
          );

          // Agar bot guruhdan chiqarilgan bo'lsa - nofaol qilish
          if (
            err.message.includes("bot was kicked") ||
            err.message.includes("chat not found")
          ) {
            await Group.findOneAndUpdate(
              { groupId: group.groupId },
              { isActive: false },
            );
            console.log(`⚠️ Guruh nofaol qilindi: ${group.title}`);
          }
        }
      }
    } catch (err) {
      console.error("sendOrderToGroups error:", err);
    }
  }

  // ========== GURUHDA BUYURTMANI QABUL QILISH ==========
  bot.on("callback_query", async (query) => {
    if (!query.data.startsWith("group_accept_")) return;

    try {
      const orderId = query.data.replace("group_accept_", "");

      // ✅ FAQAT GURUHDA ISHLAYDI
      if (
        query.message.chat.type !== "group" &&
        query.message.chat.type !== "supergroup"
      ) {
        return;
      }

      // Driver tekshiruvi
      const driver = await User.findOne({
        telegramId: query.from.id,
        role: "driver",
        isBlocked: false,
      });

      // ❌ DRIVER EMAS YOKI RO'YXATDAN O'TMAGAN
      if (!driver) {
        const botInfo = await bot.getMe();

        return bot.answerCallbackQuery(query.id, {
          text: `❌ Siz haydovchi emas yoki ro'yxatdan o'tmangansiz!\n\n@${botInfo.username} ga o'tib ro'yxatdan o'ting!`,
          show_alert: true,
        });
      }

      // Order tekshiruvi
      const order = await Order.findById(orderId);

      if (!order) {
        return bot.answerCallbackQuery(query.id, {
          text: "❌ Buyurtma topilmadi!",
          show_alert: true,
        });
      }

      if (order.status !== "pending") {
        return bot.answerCallbackQuery(query.id, {
          text: "❌ Buyurtma allaqachon qabul qilingan!",
          show_alert: true,
        });
      }

      // ✅ BUYURTMANI QABUL QILISH
      await Order.findByIdAndUpdate(orderId, {
        driverId: driver.telegramId,
        status: "accepted",
        acceptedAt: new Date(),
      });

      // Driver statistikasini yangilash
      await User.findOneAndUpdate(
        { telegramId: driver.telegramId },
        { $inc: { completedOrders: 1 } },
      );

      // Guruh statistikasini yangilash
      await Group.findOneAndUpdate(
        { groupId: query.message.chat.id },
        { $inc: { acceptedOrders: 1 } },
      );

      // Guruhda xabarni yangilash
      const updatedText =
        query.message.text +
        `\n\n✅ QABUL QILDI: @${query.from.username || driver.name}` +
        `\n⏰ ${new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`;

      try {
        await bot.editMessageText(updatedText, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }, // Tugmalarni o'chirish
        });
      } catch (err) {
        console.error("Message edit error:", err);
      }

      // ✅ PASSENGERGA DRIVER MA'LUMOTLARI
      const passenger = await User.findOne({ telegramId: order.passengerId });

      if (passenger) {
        if (driver.driverPhoto) {
          await bot.sendPhoto(passenger.telegramId, driver.driverPhoto, {
            caption:
              `🚗 HAYDOVCHI TOPILDI!\n\n` +
              `👤 ${driver.name}\n` +
              `📱 ${driver.phone}\n` +
              `🚙 ${driver.carModel}\n` +
              `🔢 ${driver.carNumber}\n` +
              `⭐ Rating: ${driver.rating?.toFixed(1) || 5.0}\n\n` +
              `📞 Haydovchi bilan bog'laning!`,
          });
        } else {
          await bot.sendMessage(
            passenger.telegramId,
            `🚗 HAYDOVCHI TOPILDI!\n\n` +
              `👤 ${driver.name}\n` +
              `📱 ${driver.phone}\n` +
              `🚙 ${driver.carModel}\n` +
              `🔢 ${driver.carNumber}\n` +
              `⭐ Rating: ${driver.rating?.toFixed(1) || 5.0}\n\n` +
              `📞 Haydovchi bilan bog'laning!`,
          );
        }
      }

      // ✅ HAYDOVCHIGA TASDIQLASH
      await bot.sendMessage(
        driver.telegramId,
        `✅ BUYURTMANI QABUL QILDINGIZ!\n\n` +
          `📍 ${order.from} → ${order.to}\n` +
          `👥 ${order.passengers} kishi\n\n` +
          `👤 Yo'lovchi: ${passenger.name}\n` +
          `📱 ${passenger.phone}\n\n` +
          `🚕 Yaxshi yo'l!`,
      );

      bot.answerCallbackQuery(query.id, {
        text: "✅ Buyurtma qabul qilindi!",
        show_alert: false,
      });

      console.log(
        `✅ Buyurtma qabul qilindi: ${driver.name} (${driver.telegramId})`,
      );
    } catch (err) {
      console.error("Guruh callback query xatosi:", err);
      bot.answerCallbackQuery(query.id, {
        text: "❌ Xatolik yuz berdi!",
        show_alert: true,
      });
    }
  });

  // ========== EXPORT FUNCTION ==========
  return {
    sendOrderToGroups,
  };
};
