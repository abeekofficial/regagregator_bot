// ==================== handlers/orderAssign.js (TUZATILGAN) ====================
const User = require("../models/user.model");
const Order = require("../models/Order.model");

module.exports = async function assignOrder(bot, orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.status !== "pending") return;

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

      // Haydovchiga xabar yuborish
      await bot.sendMessage(
        driver.telegramId,
        `🚖 Yangi buyurtma:\n📍 ${order.from} ➝ ${order.to}\n\nQabul qilmoqchimisiz?`,
        {
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
        },
      );

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

          await bot.sendMessage(
            order.passengerId,
            `🚖 Haydovchi topildi!\n\n👤 ${driver.name}\n🚗 ${driver.carModel}\n🔢 ${driver.carNumber}\n📱 ${driver.phone}`,
          );

          await bot.sendMessage(
            driver.telegramId,
            `✅ Buyurtma qabul qilindi!\n\n📱 Yo'lovchi: ${order.passengerId}\n📍 ${order.from} ➝ ${order.to}`,
          );
        }
        console.log("order", order);

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
