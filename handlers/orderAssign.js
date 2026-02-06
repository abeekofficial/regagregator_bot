const User = require("../models/user.model");
const Order = require("../models/Order.model");

module.exports = async function assignOrder(bot, orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "pending") return;

  // 1️⃣ FROM → TO mos haydovchilar (role=driver)
  let drivers = await User.find({ role: "driver" }).sort({ referralCount: -1 });
  if (!drivers.length) return;

  let currentIndex = 0;

  const tryNextDriver = async () => {
    if (currentIndex >= drivers.length) {
      await Order.findByIdAndUpdate(orderId, { status: "cancelled" });
      return;
    }

    const driver = drivers[currentIndex];
    currentIndex++;

    // 2️⃣ Haydovchiga message
    bot.sendMessage(
      driver.telegramId,
      `🚖 Yangi buyurtma:\n${order.from} ➝ ${order.to}\nQabul qilmoqchimisiz?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Qabul qilaman", callback_data: `accept_${orderId}` },
              { text: "❌ Rad etaman", callback_data: `reject_${orderId}` },
            ],
          ],
        },
      },
    );

    // 3️⃣ Timeout = 5s
    const timeout = setTimeout(() => tryNextDriver(), 5000);

    // 4️⃣ Callback listener
    const callbackListener = async (query) => {
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
        bot.sendMessage(
          order.passengerId,
          `🚖 Haydovchi topildi: ${driver.name} (${driver.carModel} - ${driver.carNumber})`,
        );
      }

      if (
        query.data === `reject_${orderId}` &&
        query.from.id === driver.telegramId
      ) {
        clearTimeout(timeout);
        bot.removeListener("callback_query", callbackListener);
        tryNextDriver(); // keyingi haydovchiga o'tish
      }
    };

    bot.on("callback_query", callbackListener);
  };

  tryNextDriver();
};
