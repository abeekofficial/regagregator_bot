// ========== handlers/orderAssign.js (TO'LIQ) ==========
const Order = require("../models/Order.model");
const User = require("../models/user.model");
const Group = require("../models/group.model");

async function assignOrder(bot, orderId) {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      console.error("Order topilmadi:", orderId);
      return;
    }

    // ✅ PRIORITY: refCount DESC, rating DESC
    const drivers = await User.find({
      role: "driver",
      isActive: true,
      isBlocked: false,
      from: order.from,
      to: order.to,
    })
      .sort({
        referralCount: -1, // Ko'p referal - yuqori priority
        rating: -1, // Yuqori rating - ikkinchi daraja
      })
      .limit(10);

    console.log(`📊 Topilgan haydovchilar: ${drivers.length} ta`);
    console.log("haydovchilar", drivers);

    // Agar haydovchi yo'q bo'lsa - guruhga yuborish
    if (drivers.length === 0) {
      console.log("⚠️ Haydovchi topilmadi, guruhga yuborilmoqda...");
      await sendOrderToGroups(bot, order);
      return;
    }

    // Har bir driverga ketma-ket yuborish (30 soniya timeout)
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      console.log(`📤 Driver ${i + 1}/${drivers.length}: ${driver.name}`);

      const accepted = await offerToDriver(bot, order, driver);
      if (accepted) {
        console.log(`✅ Driver qabul qildi: ${driver.name}`);
        return;
      }
    }

    // Hech kim qabul qilmasa - guruhga yuborish
    console.log("⚠️ Hech kim qabul qilmadi, guruhga yuborilmoqda...");
    await sendOrderToGroups(bot, order);
  } catch (err) {
    console.error("assignOrder error:", err);
  }
}

// BITTA DRIVERGA TAKLIF QILISH
async function offerToDriver(bot, order, driver) {
  return new Promise(async (resolve) => {
    try {
      const passenger = await User.findOne({ telegramId: order.passengerId });

      if (!passenger) {
        console.error("Passenger topilmadi");
        resolve(false);
        return;
      }

      let message = `🚖 YANGI BUYURTMA!\n\n`;
      message += `📍 ${order.from} ➝ ${order.to}\n`;
      message += `👥 Yo'lovchilar: ${order.passengers}\n\n`;
      message += `👤 Buyurtmachi: ${passenger.name}\n`;
      message += `📱 Telefon: ${passenger.phone}\n`;
      if (passenger.username) message += `Telegram: @${passenger.username}\n`;

      const sentMsg = await bot.sendMessage(driver.telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Qabul qilish", callback_data: `accept_${order._id}` },
              { text: "❌ Rad etish", callback_data: `reject_${order._id}` },
            ],
          ],
        },
      });

      // 30 soniya timeout
      const timeout = setTimeout(() => {
        bot.removeListener("callback_query", handler);
        console.log(`⏰ Timeout: ${driver.name}`);
        resolve(false);
      }, 30000);

      const handler = async (query) => {
        if (query.from.id !== driver.telegramId) return;

        // ✅ QABUL QILDI
        if (query.data === `accept_${order._id}`) {
          clearTimeout(timeout);
          bot.removeListener("callback_query", handler);

          // Order statusini yangilash
          await Order.findByIdAndUpdate(order._id, {
            driverId: driver.telegramId,
            status: "accepted",
            acceptedAt: new Date(),
          });

          // Driver statistikasini yangilash
          await User.findOneAndUpdate(
            { telegramId: driver.telegramId },
            { $inc: { completedOrders: 1 } },
          );

          // Driverga tasdiqlash
          await bot.editMessageText(message + `\n\n✅ SIZ QABUL QILDINGIZ!`, {
            chat_id: driver.telegramId,
            message_id: sentMsg.message_id,
            reply_markup: { inline_keyboard: [] },
          });

          // ✅ PASSENGERGA DRIVER MA'LUMOTLARI + RASM
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

          await bot.answerCallbackQuery(query.id, {
            text: "✅ Buyurtma qabul qilindi!",
            show_alert: false,
          });

          resolve(true);
        }

        // ❌ RAD ETDI
        if (query.data === `reject_${order._id}`) {
          clearTimeout(timeout);
          bot.removeListener("callback_query", handler);

          await bot.editMessageText(message + `\n\n❌ SIZ RAD ETDINGIZ`, {
            chat_id: driver.telegramId,
            message_id: sentMsg.message_id,
            reply_markup: { inline_keyboard: [] },
          });

          await bot.answerCallbackQuery(query.id, {
            text: "❌ Buyurtma rad etildi",
            show_alert: false,
          });

          resolve(false);
        }
      };

      bot.on("callback_query", handler);
    } catch (err) {
      console.error("offerToDriver error:", err);
      resolve(false);
    }
  });
}

// GURUHGA YUBORISH
async function sendOrderToGroups(bot, order) {
  try {
    const groups = await Group.find({ isActive: true });
    const passenger = await User.findOne({ telegramId: order.passengerId });

    if (!passenger) return;

    for (const group of groups) {
      try {
        let message = `🚖 YANGI BUYURTMA!\n\n`;
        message += `📍 ${order.from} ➝ ${order.to}\n`;
        message += `👥 ${order.passengers} kishi\n`;
        message += `👤 ${passenger.name}\n`;
        message += `📱 ${passenger.phone}\n`;
        if (passenger.username) message += `@${passenger.username}\n`;
        message += `\n⏰ Qabul qilish uchun tugmani bosing ⬇️`;

        await bot.sendMessage(group.groupId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Qabul qilaman",
                  callback_data: `group_accept_${order._id}`,
                },
              ],
            ],
          },
        });

        await Group.findOneAndUpdate(
          { groupId: group.groupId },
          { $inc: { totalOrders: 1 } },
        );
      } catch (err) {
        console.error(`Guruhga yuborishda xato (${group.title}):`, err);
      }
    }
  } catch (err) {
    console.error("sendOrderToGroups error:", err);
  }
}

module.exports = assignOrder;
