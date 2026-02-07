// ==================== handlers/orderAssign.js (TO'LIQ YANGILANGAN) ====================
const User = require("../models/user.model");
const Order = require("../models/Order.model");

module.exports = async function assignOrder(bot, orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.status !== "pending") return;

    // ✅ Yo'lovchi ma'lumotlarini olish
    const passenger = await User.findOne({ telegramId: order.passengerId });
    if (!passenger) {
      await Order.findByIdAndUpdate(orderId, { status: "cancelled" });
      return bot.sendMessage(
        order.passengerId,
        "❌ Xatolik yuz berdi, qayta urinib ko'ring",
      );
    }

    // Faqat active haydovchilar
    let drivers = await User.find({
      role: "driver",
      isActive: true,
    }).sort({ referralCount: -1 });

    if (!drivers.length) {
      await Order.findByIdAndUpdate(orderId, { status: "cancelled" });
      return bot.sendMessage(
        order.passengerId,
        "❌ Afsuski, hozirda haydovchi topilmadi",
      );
    }

    let currentIndex = 0;
    let timeout;
    let callbackListener;

    const tryNextDriver = async () => {
      if (currentIndex >= drivers.length) {
        await Order.findByIdAndUpdate(orderId, { status: "cancelled" });
        return bot.sendMessage(
          order.passengerId,
          "❌ Hech bir haydovchi buyurtmani qabul qilmadi",
        );
      }

      const driver = drivers[currentIndex];
      currentIndex++;

      // ✅ Haydovchiga to'liq ma'lumot bilan xabar yuborish
      let orderMessage = `🚖 Yangi buyurtma!\n\n`;
      orderMessage += `📍 ${order.from} ➝ ${order.to}\n\n`;

      // Buyurtma turi
      if (order.orderType === "passenger") {
        orderMessage += `👥 Yo'lovchi tashish\n`;
        orderMessage += `Yo'lovchilar soni: ${order.passengers} kishi\n\n`;
      } else if (order.orderType === "cargo") {
        orderMessage += `📦 Yuk tashish\n`;
        orderMessage += `Og'irligi: ${order.cargoWeight} kg\n\n`;
      }

      // ✅ Yo'lovchi ma'lumotlari
      orderMessage += `👤 BUYURTMACHI MA'LUMOTLARI:\n`;
      orderMessage += `Ismi: ${passenger.name}\n`;

      if (passenger.username) {
        orderMessage += `Username: @${passenger.username}\n`;
      }

      orderMessage += `📱 Telefon: ${passenger.phone}\n\n`;
      orderMessage += `❓ Buyurtmani qabul qilasizmi?`;

      // Haydovchiga xabar yuborish
      await bot.sendMessage(driver.telegramId, orderMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Qabul qilaman",
                callback_data: `accept_${orderId}`,
              },
              { text: "❌ Rad etaman", callback_data: `reject_${orderId}` },
            ],
          ],
        },
      });

      // Timeout
      timeout = setTimeout(() => {
        if (callbackListener) {
          bot.removeListener("callback_query", callbackListener);
        }
        tryNextDriver();
      }, 30000);

      // Callback listener
      callbackListener = async (query) => {
        // Accept
        if (
          query.data === `accept_${orderId}` &&
          query.from.id === driver.telegramId
        ) {
          clearTimeout(timeout);
          bot.removeListener("callback_query", callbackListener);

          await Order.findByIdAndUpdate(orderId, {
            driverId: driver.telegramId,
            status: "accepted",
          });

          await bot.answerCallbackQuery(query.id, {
            text: "✅ Buyurtmani qabul qildingiz",
          });

          // ✅ Yo'lovchiga haydovchi ma'lumotlarini yuborish
          let driverInfo = `🚖 Haydovchi topildi!\n\n`;
          driverInfo += `👤 ${driver.name}\n`;

          if (driver.username) {
            driverInfo += `Username: @${driver.username}\n`;
          }

          driverInfo += `🚗 ${driver.carModel}\n`;
          driverInfo += `🔢 ${driver.carNumber}\n`;
          driverInfo += `📱 ${driver.phone}`;

          await bot.sendMessage(order.passengerId, driverInfo);

          // ✅ Haydovchiga buyurtma ma'lumotlarini yuborish
          let confirmMessage = `✅ Buyurtma qabul qilindi!\n\n`;
          confirmMessage += `📍 ${order.from} ➝ ${order.to}\n\n`;

          if (order.orderType === "passenger") {
            confirmMessage += `👥 Yo'lovchilar: ${order.passengers} kishi\n\n`;
          } else {
            confirmMessage += `📦 Yuk: ${order.cargoWeight} kg\n\n`;
          }

          confirmMessage += `👤 BUYURTMACHI:\n`;
          confirmMessage += `Ismi: ${passenger.name}\n`;

          if (passenger.username) {
            confirmMessage += `Username: @${passenger.username}\n`;
          }

          confirmMessage += `📱 Telefon: ${passenger.phone}`;

          await bot.sendMessage(driver.telegramId, confirmMessage);
        }

        // Reject
        if (
          query.data === `reject_${orderId}` &&
          query.from.id === driver.telegramId
        ) {
          clearTimeout(timeout);
          bot.removeListener("callback_query", callbackListener);
          await bot.answerCallbackQuery(query.id, {
            text: "❌ Rad etdingiz",
          });
          tryNextDriver();
        }
      };

      bot.on("callback_query", callbackListener);
    };

    tryNextDriver();
  } catch (err) {
    console.error("Order assign error:", err);
  }
};
