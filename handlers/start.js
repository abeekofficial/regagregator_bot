// ========== handlers/start.js (YANGILANGAN - deep link accept_ qo'shildi) ==========
const User = require("../models/user.model");
const Order = require("../models/Order.model");
const Session = require("../models/session.model");
const logger = require("../utils/logger");
const { handleReferral } = require("./referal");
const { showMainMenu } = require("./menu");
const config = require("../config/environment");

module.exports = (bot) => {
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1]?.trim();

    logger.info("START bosildi:", chatId, "param:", param);

    try {
      let user = await User.findOne({ telegramId: chatId });

      // ========== DEEP LINK: accept_<orderId> ==========
      // Guruhdan "Qabul qilaman" tugmasini bosganda keladi
      if (param && param.startsWith("accept_")) {
        const orderId = param.replace("accept_", "");

        // 1️⃣ YO'LOVCHI bo'lib ro'yxatdan o'tgan — zakaz ololmaydi
        if (user && user.role === "passenger") {
          return bot.sendMessage(
            chatId,
            `❌ Siz yo'lovchi sifatida ro'yxatdan o'tgansiz.\n\nBuyurtma qabul qilish faqat haydovchilar uchun!`,
            {
              reply_markup: {
                keyboard: [
                  ["🚖 Buyurtma berish", "📦 Yuk/Pochta"],
                  ["👤 Profilim"],
                ],
                resize_keyboard: true,
              },
            },
          );
        }

        // 2️⃣ DRIVER bo'lib ro'yxatdan o'tgan — darhol qabul qiladi
        if (user && user.role === "driver") {
          const order = await Order.findById(orderId);

          if (!order) {
            await showMainMenu(bot, chatId, user);
            return bot.sendMessage(
              chatId,
              "❌ Buyurtma topilmadi yoki muddati o'tgan!",
            );
          }

          if (order.status !== "pending" || order.driverId) {
            await showMainMenu(bot, chatId, user);
            return bot.sendMessage(
              chatId,
              "❌ Bu buyurtma allaqachon qabul qilingan!",
            );
          }

          // Qabul qilish
          await Order.findByIdAndUpdate(orderId, {
            driverId: chatId,
            status: "accepted",
            acceptedAt: new Date(),
          });

          // ✅ Guruh xabarlarini o'chirish
          await deleteGroupMessages(bot, order);

          // Passengerga xabar
          await notifyPassenger(bot, order, user);

          // Driverga xabar
          const typeIcon = order.orderType === "cargo" ? "📦" : "👥";
          const typeText =
            order.orderType === "cargo"
              ? `Yuk: ${order.cargoDescription}`
              : `${order.passengers || 1} kishi`;

          const passenger = await User.findOne({
            telegramId: order.passengerId,
          });

          await bot.sendMessage(
            chatId,
            `✅ BUYURTMANI QABUL QILDINGIZ!\n\n` +
              `📍 ${order.from} → ${order.to}\n` +
              `${typeIcon} ${typeText}\n\n` +
              (passenger
                ? `👤 Yo'lovchi: ${passenger.name}\n📱 ${passenger.phone}\n\n`
                : "") +
              `💡 Yo'lovchini olgach "Safar boshlash" tugmasini bosing:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🚕 Safar boshlash",
                      callback_data: `start_trip_${orderId}`,
                    },
                  ],
                ],
              },
            },
          );

          logger.info(
            `Driver ${chatId} deep link orqali qabul qildi: ${orderId}`,
          );
          return showMainMenu(bot, chatId, user);
        }

        // 3️⃣ YANGI foydalanuvchi — ro'yxatdan o'tkazamiz, keyin zakaz beramiz
        if (!user) {
          user = await User.create({
            telegramId: chatId,
            username: msg.from.username,
          });
        }

        // Sessiyaga orderId saqlaymiz
        await Session.deleteMany({ telegramId: chatId });
        await Session.create({
          telegramId: chatId,
          step: "PENDING_ORDER_ACCEPT",
          data: { pendingOrderId: orderId },
        });

        return bot.sendMessage(
          chatId,
          `🚗 Buyurtmani qabul qilish uchun avval haydovchi sifatida ro'yxatdan o'ting!`,
          {
            reply_markup: {
              keyboard: [["🚕 Haydovchi"]],
              resize_keyboard: true,
            },
          },
        );
      }

      // ========== ODDIY START ==========

      // User mavjud va role bor — main menu
      if (user && user.role) {
        // Ro'yxatdan o'tgandan keyin pending order borligini tekshirish
        const pendingSession = await Session.findOne({
          telegramId: chatId,
          step: "PENDING_ORDER_ACCEPT",
        });

        if (pendingSession && user.role === "driver") {
          const pendingOrderId = pendingSession.data?.pendingOrderId;
          await Session.deleteMany({ telegramId: chatId });

          if (pendingOrderId) {
            const order = await Order.findById(pendingOrderId);
            if (order && order.status === "pending" && !order.driverId) {
              // Sessiyani o'chirib, accept logini chaqirish
              await Order.findByIdAndUpdate(pendingOrderId, {
                driverId: chatId,
                status: "accepted",
                acceptedAt: new Date(),
              });

              bot.sendMessage(
                chatId,
                `✅ Buyurtma qabul qilindi!\n📍 ${order.from} → ${order.to}`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "🚕 Safar boshlash",
                          callback_data: `start_trip_${pendingOrderId}`,
                        },
                      ],
                    ],
                  },
                },
              );

              const passenger = await User.findOne({
                telegramId: order.passengerId,
              });
              if (passenger) {
                bot.sendMessage(
                  passenger.telegramId,
                  `🚗 HAYDOVCHI TOPILDI!\n\n👤 ${user.name}\n📱 ${user.phone}\n🚙 ${user.carModel}\n🔢 ${user.carNumber}\n⭐ Rating: ${user.rating?.toFixed(1) || "5.0"}`,
                );
              }
            }
          }
        }

        return showMainMenu(bot, chatId, user);
      }

      // Yangi user yaratish
      if (!user) {
        user = await User.create({
          telegramId: chatId,
          username: msg.from.username,
        });
        logger.info("Yangi user yaratildi:", chatId);
      }

      // Referal bilan kelgan
      let referralInfo = "";
      if (param && param.startsWith("REF")) {
        const result = await handleReferral(bot, msg, param);
        if (result.success) {
          if (result.inviterRole === "passenger") {
            referralInfo = `\n\n🎁 ${result.inviterName} sizni taklif qildi!\n💰 Siz ro'yxatdan o'tgach, u 5000 so'm bonus oladi!`;
          } else {
            referralInfo = `\n\n🚗 Haydovchi ${result.inviterName} sizni taklif qildi!\nU buyurtma olishda yuqori prioritetga ega bo'ladi!`;
          }
        }
      }

      // Role tanlash ekrani
      bot.sendMessage(
        chatId,
        `🚕 Assalamu aleykum! Taksi botga xush kelibsiz!${referralInfo}\n${
          config.IS_DEVELOPMENT ? "\n⚠️ TEST BOT\n" : ""
        }\nKim sifatida kirmoqchisiz?`,
        {
          reply_markup: {
            keyboard: [["🚕 Haydovchi", "🧍 Yo'lovchi"]],
            resize_keyboard: true,
          },
        },
      );
    } catch (err) {
      logger.error("Start error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi, /start ni qayta bosing");
    }
  });
};

// ========== HELPER: GURUH XABARLARINI O'CHIRISH ==========
async function deleteGroupMessages(bot, order) {
  try {
    const freshOrder = await Order.findById(order._id);
    if (
      !freshOrder ||
      !freshOrder.groupMessages ||
      freshOrder.groupMessages.length === 0
    )
      return;

    for (const gm of freshOrder.groupMessages) {
      try {
        await bot.deleteMessage(gm.groupId, gm.messageId);
        logger.info(
          `Guruh xabari o'chirildi: group=${gm.groupId}, msg=${gm.messageId}`,
        );
      } catch (err) {
        logger.warn(`Guruh xabarini o'chirishda xato: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error("deleteGroupMessages error:", err);
  }
}

// ========== HELPER: PASSENGERGA DRIVER MA'LUMOTLARI ==========
async function notifyPassenger(bot, order, driver) {
  try {
    const User = require("../models/user.model");
    const passenger = await User.findOne({ telegramId: order.passengerId });
    if (!passenger) return;

    const msg =
      `🚗 HAYDOVCHI TOPILDI!\n\n` +
      `👤 ${driver.name}\n` +
      `📱 ${driver.phone}\n` +
      `🚙 ${driver.carModel}\n` +
      `🔢 ${driver.carNumber}\n` +
      `⭐ Rating: ${driver.rating?.toFixed(1) || "5.0"}\n\n` +
      `📞 Haydovchi bilan bog'laning!\n\n` +
      `⏳ Safar boshlanishini kuting...`;

    if (driver.driverPhoto) {
      await bot.sendPhoto(passenger.telegramId, driver.driverPhoto, {
        caption: msg,
      });
    } else {
      await bot.sendMessage(passenger.telegramId, msg);
    }
  } catch (err) {
    logger.error("notifyPassenger error:", err);
  }
}
