// ========== handlers/orderAssign.js (TO'LIQ YANGILANGAN) ==========
const Order = require("../models/Order.model");
const User = require("../models/user.model");
const Group = require("../models/group.model");
const logger = require("../utils/logger");

// ✅ ACTIVE LISTENERS (global)
const activeListeners = new Map();

async function assignOrder(bot, orderId) {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      logger.error("Order topilmadi:", orderId);
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
      .sort({ referralCount: -1, rating: -1 })
      .limit(10);

    logger.info(`📊 Topilgan haydovchilar: ${drivers.length} ta`);

    if (drivers.length === 0) {
      logger.warn("⚠️ Haydovchi topilmadi, guruhga yuborilmoqda...");
      await sendOrderToGroups(bot, order);
      return;
    }

    // Har bir driverga ketma-ket yuborish
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      logger.info(`📤 Driver ${i + 1}/${drivers.length}: ${driver.name}`);

      const accepted = await offerToDriver(bot, order, driver);
      if (accepted) {
        logger.info(`✅ Driver qabul qildi: ${driver.name}`);
        return;
      }
    }

    // Hech kim qabul qilmasa - guruhga yuborish
    logger.warn("⚠️ Hech kim qabul qilmadi, guruhga yuborilmoqda...");
    await sendOrderToGroups(bot, order);
  } catch (err) {
    logger.error("assignOrder error:", err);
  }
}

// ========== BITTA DRIVERGA TAKLIF QILISH ==========
async function offerToDriver(bot, order, driver) {
  return new Promise(async (resolve) => {
    try {
      const passenger = await User.findOne({ telegramId: order.passengerId });

      if (!passenger) {
        logger.error("Passenger topilmadi");
        resolve(false);
        return;
      }

      const typeEmoji = order.orderType === "cargo" ? "📦" : "👥";
      const typeText =
        order.orderType === "cargo"
          ? `Yuk: ${order.cargoDescription}`
          : `Yo'lovchilar: ${order.passengers || 1} kishi`;

      let message = `🚖 YANGI BUYURTMA!\n\n`;
      message += `📍 ${order.from} ➝ ${order.to}\n`;
      message += `${typeEmoji} ${typeText}\n\n`;
      message += `👤 Buyurtmachi: ${passenger.name}\n`;
      message += `📱 Telefon: ${passenger.phone}\n`;
      if (passenger.username) message += `Telegram: @${passenger.username}\n`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Qabul qilish", callback_data: `accept_${order._id}` },
              { text: "❌ Rad etish", callback_data: `reject_${order._id}` },
            ],
          ],
        },
      };

      let sentMsg;
      // Yuk buyurtmasi + rasm bo'lsa — rasm bilan yuborish
      if (order.orderType === "cargo" && order.cargoPhotoId) {
        sentMsg = await bot.sendPhoto(driver.telegramId, order.cargoPhotoId, {
          caption: message,
          ...keyboard,
        });
      } else {
        sentMsg = await bot.sendMessage(driver.telegramId, message, keyboard);
      }

      // ✅ LISTENER ID yaratish
      const listenerId = `offer_${order._id}_${driver.telegramId}`;

      // 30 soniya timeout
      const timeout = setTimeout(() => {
        cleanupListener(bot, listenerId);
        logger.info(`⏰ Timeout: ${driver.name}`);
        resolve(false);
      }, 30000);

      const handler = async (query) => {
        // Faqat shu driver uchun
        if (query.from.id !== driver.telegramId) return;

        // Faqat shu order uchun
        if (
          query.data !== `accept_${order._id}` &&
          query.data !== `reject_${order._id}`
        ) {
          return;
        }

        // ✅ QABUL QILDI
        if (query.data === `accept_${order._id}`) {
          clearTimeout(timeout);
          cleanupListener(bot, listenerId);

          // Double-accept himoyasi
          const freshOrder = await Order.findById(order._id);
          if (!freshOrder || freshOrder.driverId) {
            await bot.answerCallbackQuery(query.id, {
              text: "❌ Buyurtma allaqachon qabul qilingan!",
              show_alert: true,
            });
            resolve(false);
            return;
          }

          const updatedOrder = await Order.findByIdAndUpdate(
            order._id,
            {
              driverId: driver.telegramId,
              status: "accepted",
              acceptedAt: new Date(),
            },
            { new: true },
          );

          if (!updatedOrder) {
            await bot.answerCallbackQuery(query.id, {
              text: "❌ Buyurtma allaqachon qabul qilingan!",
              show_alert: true,
            });
            resolve(false);
            return;
          }

          // ✅ DARHOL resolve(true) - xabar yuborishdan OLDIN
          // Shunday qilsak, xabar yuborishda xato bo'lsa ham guruhga yuborilmaydi
          resolve(true);

          await bot.answerCallbackQuery(query.id, {
            text: "✅ Buyurtma qabul qilindi!",
            show_alert: false,
          });

          // Driverga tasdiqlash xabari
          try {
            if (order.orderType === "cargo" && order.cargoPhotoId) {
              await bot.editMessageCaption(
                message + `\n\n✅ SIZ QABUL QILDINGIZ!`,
                {
                  chat_id: driver.telegramId,
                  message_id: sentMsg.message_id,
                  reply_markup: { inline_keyboard: [] },
                },
              );
            } else {
              await bot.editMessageText(
                message + `\n\n✅ SIZ QABUL QILDINGIZ!`,
                {
                  chat_id: driver.telegramId,
                  message_id: sentMsg.message_id,
                  reply_markup: { inline_keyboard: [] },
                },
              );
            }
          } catch (editErr) {
            logger.error("editMessage xatosi (muhim emas):", editErr.message);
          }

          // Passengerga driver ma'lumotlari
          const passengerMsg =
            `🚗 HAYDOVCHI TOPILDI!\n\n` +
            `👤 ${driver.name}\n` +
            `📱 ${driver.phone}\n` +
            `🚙 ${driver.carModel}\n` +
            `🔢 ${driver.carNumber}\n` +
            `⭐ Rating: ${driver.rating?.toFixed(1) || "5.0"}\n\n` +
            `📞 Haydovchi bilan bog'laning!\n\n` +
            `⏳ Safar boshlanishini kuting...`;

          try {
            if (driver.driverPhoto) {
              await bot.sendPhoto(passenger.telegramId, driver.driverPhoto, {
                caption: passengerMsg,
              });
            } else {
              await bot.sendMessage(passenger.telegramId, passengerMsg);
            }
          } catch (msgErr) {
            logger.error("Passengerga xabar xatosi:", msgErr.message);
          }

          // Driverga safar boshlash tugmasi
          try {
            await bot.sendMessage(
              driver.telegramId,
              `✅ Buyurtma qabul qilindi!\n\n📍 ${order.from} → ${order.to}\n${typeEmoji} ${typeText}\n\n💡 Yo'lovchini olgach "Safar boshlash" tugmasini bosing:`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "🚕 Safar boshlash",
                        callback_data: `start_trip_${order._id}`,
                      },
                    ],
                  ],
                },
              },
            );
          } catch (msgErr) {
            logger.error("Driverga xabar xatosi:", msgErr.message);
          }
        }

        // ❌ RAD ETDI
        if (query.data === `reject_${order._id}`) {
          clearTimeout(timeout);
          cleanupListener(bot, listenerId);

          if (order.orderType === "cargo" && order.cargoPhotoId) {
            await bot.editMessageCaption(message + `\n\n❌ SIZ RAD ETDINGIZ`, {
              chat_id: driver.telegramId,
              message_id: sentMsg.message_id,
              reply_markup: { inline_keyboard: [] },
            });
          } else {
            await bot.editMessageText(message + `\n\n❌ SIZ RAD ETDINGIZ`, {
              chat_id: driver.telegramId,
              message_id: sentMsg.message_id,
              reply_markup: { inline_keyboard: [] },
            });
          }

          await bot.answerCallbackQuery(query.id, {
            text: "❌ Buyurtma rad etildi",
            show_alert: false,
          });

          resolve(false);
        }
      };

      // Listener'ni saqlash
      activeListeners.set(listenerId, handler);
      bot.on("callback_query", handler);
    } catch (err) {
      logger.error("offerToDriver error:", err);
      resolve(false);
    }
  });
}

// ========== LISTENER TOZALASH ==========
function cleanupListener(bot, listenerId) {
  const handler = activeListeners.get(listenerId);
  if (handler) {
    bot.removeListener("callback_query", handler);
    activeListeners.delete(listenerId);
  }
}

// ========== GURUHGA YUBORISH ==========
async function sendOrderToGroups(bot, order) {
  try {
    const botInfo = await bot.getMe();
    const groups = await Group.find({ isActive: true });
    const passenger = await User.findOne({ telegramId: order.passengerId });

    if (!passenger) {
      logger.error("Passenger topilmadi");
      return;
    }

    if (groups.length === 0) {
      logger.warn("Hech qanday faol guruh topilmadi");
      return;
    }

    logger.info(`📤 Buyurtma ${groups.length} ta guruhga yuborilmoqda...`);

    const typeEmoji = order.orderType === "cargo" ? "📦" : "👥";
    const typeText =
      order.orderType === "cargo"
        ? `Yuk: ${order.cargoDescription}`
        : `${order.passengers || 1} kishi`;

    let message = `🚖 YANGI BUYURTMA!\n\n`;
    message += `📍 ${order.from} ➝ ${order.to}\n`;
    message += `${typeEmoji} ${typeText}\n`;
    message += `⏰ ${new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}\n\n`;
    message += `⚠️ Qabul qilish uchun botga o'ting ⬇️`;

    for (const group of groups) {
      try {
        // ✅ DEEP LINK orqali qabul qilish (callback_data emas, URL)
        await bot.sendMessage(group.groupId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Qabul qilaman",
                  url: `https://t.me/${botInfo.username}?start=accept_${order._id}`,
                },
              ],
            ],
          },
        });

        await Group.findOneAndUpdate(
          { groupId: group.groupId },
          { $inc: { totalOrders: 1 }, lastActivity: new Date() },
        );

        logger.info(`✅ Guruhga yuborildi: ${group.title}`);
      } catch (err) {
        logger.error(
          `❌ Guruhga yuborishda xato (${group.title}):`,
          err.message,
        );

        if (
          err.message.includes("bot was kicked") ||
          err.message.includes("chat not found")
        ) {
          await Group.findOneAndUpdate(
            { groupId: group.groupId },
            { isActive: false },
          );
          logger.warn(`⚠️ Guruh nofaol qilindi: ${group.title}`);
        }
      }
    }
  } catch (err) {
    logger.error("sendOrderToGroups error:", err); // ========== handlers/orderAssign.js (TO'LIQ YANGILANGAN) ==========
    const Order = require("../models/Order.model");
    const User = require("../models/user.model");
    const Group = require("../models/group.model");
    const logger = require("../utils/logger");

    // ✅ ACTIVE LISTENERS (global)
    const activeListeners = new Map();

    async function assignOrder(bot, orderId) {
      try {
        const order = await Order.findById(orderId);

        if (!order) {
          logger.error("Order topilmadi:", orderId);
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
          .sort({ referralCount: -1, rating: -1 })
          .limit(10);

        logger.info(`📊 Topilgan haydovchilar: ${drivers.length} ta`);

        if (drivers.length === 0) {
          logger.warn("⚠️ Haydovchi topilmadi, guruhga yuborilmoqda...");
          await sendOrderToGroups(bot, order);
          return;
        }

        // Har bir driverga ketma-ket yuborish
        for (let i = 0; i < drivers.length; i++) {
          const driver = drivers[i];
          logger.info(`📤 Driver ${i + 1}/${drivers.length}: ${driver.name}`);

          const accepted = await offerToDriver(bot, order, driver);
          if (accepted) {
            logger.info(`✅ Driver qabul qildi: ${driver.name}`);
            return;
          }
        }

        // Hech kim qabul qilmasa - guruhga yuborish
        logger.warn("⚠️ Hech kim qabul qilmadi, guruhga yuborilmoqda...");
        await sendOrderToGroups(bot, order);
      } catch (err) {
        logger.error("assignOrder error:", err);
      }
    }

    // ========== BITTA DRIVERGA TAKLIF QILISH ==========
    async function offerToDriver(bot, order, driver) {
      return new Promise(async (resolve) => {
        try {
          const passenger = await User.findOne({
            telegramId: order.passengerId,
          });

          if (!passenger) {
            logger.error("Passenger topilmadi");
            resolve(false);
            return;
          }

          const typeEmoji = order.orderType === "cargo" ? "📦" : "👥";
          const typeText =
            order.orderType === "cargo"
              ? `Yuk: ${order.cargoDescription}`
              : `Yo'lovchilar: ${order.passengers || 1} kishi`;

          let message = `🚖 YANGI BUYURTMA!\n\n`;
          message += `📍 ${order.from} ➝ ${order.to}\n`;
          message += `${typeEmoji} ${typeText}\n\n`;
          message += `👤 Buyurtmachi: ${passenger.name}\n`;
          message += `📱 Telefon: ${passenger.phone}\n`;
          if (passenger.username)
            message += `Telegram: @${passenger.username}\n`;

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Qabul qilish",
                    callback_data: `accept_${order._id}`,
                  },
                  {
                    text: "❌ Rad etish",
                    callback_data: `reject_${order._id}`,
                  },
                ],
              ],
            },
          };

          let sentMsg;
          // Yuk buyurtmasi + rasm bo'lsa — rasm bilan yuborish
          if (order.orderType === "cargo" && order.cargoPhotoId) {
            sentMsg = await bot.sendPhoto(
              driver.telegramId,
              order.cargoPhotoId,
              {
                caption: message,
                ...keyboard,
              },
            );
          } else {
            sentMsg = await bot.sendMessage(
              driver.telegramId,
              message,
              keyboard,
            );
          }

          // ✅ LISTENER ID yaratish
          const listenerId = `offer_${order._id}_${driver.telegramId}`;

          // 30 soniya timeout
          const timeout = setTimeout(() => {
            cleanupListener(bot, listenerId);
            logger.info(`⏰ Timeout: ${driver.name}`);
            resolve(false);
          }, 30000);

          const handler = async (query) => {
            // Faqat shu driver uchun
            if (query.from.id !== driver.telegramId) return;

            // Faqat shu order uchun
            if (
              query.data !== `accept_${order._id}` &&
              query.data !== `reject_${order._id}`
            ) {
              return;
            }

            // ✅ QABUL QILDI
            if (query.data === `accept_${order._id}`) {
              clearTimeout(timeout);
              cleanupListener(bot, listenerId);

              // Double-accept himoyasi
              const freshOrder = await Order.findById(order._id);
              if (!freshOrder || freshOrder.driverId) {
                await bot.answerCallbackQuery(query.id, {
                  text: "❌ Buyurtma allaqachon qabul qilingan!",
                  show_alert: true,
                });
                resolve(false);
                return;
              }

              const updatedOrder = await Order.findByIdAndUpdate(
                order._id,
                {
                  driverId: driver.telegramId,
                  status: "accepted",
                  acceptedAt: new Date(),
                },
                { new: true },
              );

              if (!updatedOrder) {
                await bot.answerCallbackQuery(query.id, {
                  text: "❌ Buyurtma allaqachon qabul qilingan!",
                  show_alert: true,
                });
                resolve(false);
                return;
              }

              // ✅ DARHOL resolve(true) - xabar yuborishdan OLDIN
              // Shunday qilsak, xabar yuborishda xato bo'lsa ham guruhga yuborilmaydi
              resolve(true);

              await bot.answerCallbackQuery(query.id, {
                text: "✅ Buyurtma qabul qilindi!",
                show_alert: false,
              });

              // Driverga tasdiqlash xabari
              try {
                if (order.orderType === "cargo" && order.cargoPhotoId) {
                  await bot.editMessageCaption(
                    message + `\n\n✅ SIZ QABUL QILDINGIZ!`,
                    {
                      chat_id: driver.telegramId,
                      message_id: sentMsg.message_id,
                      reply_markup: { inline_keyboard: [] },
                    },
                  );
                } else {
                  await bot.editMessageText(
                    message + `\n\n✅ SIZ QABUL QILDINGIZ!`,
                    {
                      chat_id: driver.telegramId,
                      message_id: sentMsg.message_id,
                      reply_markup: { inline_keyboard: [] },
                    },
                  );
                }
              } catch (editErr) {
                logger.error(
                  "editMessage xatosi (muhim emas):",
                  editErr.message,
                );
              }

              // Passengerga driver ma'lumotlari
              const passengerMsg =
                `🚗 HAYDOVCHI TOPILDI!\n\n` +
                `👤 ${driver.name}\n` +
                `📱 ${driver.phone}\n` +
                `🚙 ${driver.carModel}\n` +
                `🔢 ${driver.carNumber}\n` +
                `⭐ Rating: ${driver.rating?.toFixed(1) || "5.0"}\n\n` +
                `📞 Haydovchi bilan bog'laning!\n\n` +
                `⏳ Safar boshlanishini kuting...`;

              try {
                if (driver.driverPhoto) {
                  await bot.sendPhoto(
                    passenger.telegramId,
                    driver.driverPhoto,
                    {
                      caption: passengerMsg,
                    },
                  );
                } else {
                  await bot.sendMessage(passenger.telegramId, passengerMsg);
                }
              } catch (msgErr) {
                logger.error("Passengerga xabar xatosi:", msgErr.message);
              }

              // Driverga safar boshlash tugmasi
              try {
                await bot.sendMessage(
                  driver.telegramId,
                  `✅ Buyurtma qabul qilindi!\n\n📍 ${order.from} → ${order.to}\n${typeEmoji} ${typeText}\n\n💡 Yo'lovchini olgach "Safar boshlash" tugmasini bosing:`,
                  {
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "🚕 Safar boshlash",
                            callback_data: `start_trip_${order._id}`,
                          },
                        ],
                      ],
                    },
                  },
                );
              } catch (msgErr) {
                logger.error("Driverga xabar xatosi:", msgErr.message);
              }
            }

            // ❌ RAD ETDI
            if (query.data === `reject_${order._id}`) {
              clearTimeout(timeout);
              cleanupListener(bot, listenerId);

              if (order.orderType === "cargo" && order.cargoPhotoId) {
                await bot.editMessageCaption(
                  message + `\n\n❌ SIZ RAD ETDINGIZ`,
                  {
                    chat_id: driver.telegramId,
                    message_id: sentMsg.message_id,
                    reply_markup: { inline_keyboard: [] },
                  },
                );
              } else {
                await bot.editMessageText(message + `\n\n❌ SIZ RAD ETDINGIZ`, {
                  chat_id: driver.telegramId,
                  message_id: sentMsg.message_id,
                  reply_markup: { inline_keyboard: [] },
                });
              }

              await bot.answerCallbackQuery(query.id, {
                text: "❌ Buyurtma rad etildi",
                show_alert: false,
              });

              resolve(false);
            }
          };

          // Listener'ni saqlash
          activeListeners.set(listenerId, handler);
          bot.on("callback_query", handler);
        } catch (err) {
          logger.error("offerToDriver error:", err);
          resolve(false);
        }
      });
    }

    // ========== LISTENER TOZALASH ==========
    function cleanupListener(bot, listenerId) {
      const handler = activeListeners.get(listenerId);
      if (handler) {
        bot.removeListener("callback_query", handler);
        activeListeners.delete(listenerId);
      }
    }

    // ========== GURUHGA YUBORISH ==========
    async function sendOrderToGroups(bot, order) {
      try {
        const botInfo = await bot.getMe();
        const groups = await Group.find({ isActive: true });
        const passenger = await User.findOne({ telegramId: order.passengerId });

        if (!passenger) {
          logger.error("Passenger topilmadi");
          return;
        }

        if (groups.length === 0) {
          logger.warn("Hech qanday faol guruh topilmadi");
          return;
        }

        logger.info(`📤 Buyurtma ${groups.length} ta guruhga yuborilmoqda...`);

        const typeEmoji = order.orderType === "cargo" ? "📦" : "👥";
        const typeText =
          order.orderType === "cargo"
            ? `Yuk: ${order.cargoDescription}`
            : `${order.passengers || 1} kishi`;

        let message = `🚖 YANGI BUYURTMA!\n\n`;
        message += `📍 ${order.from} ➝ ${order.to}\n`;
        message += `${typeEmoji} ${typeText}\n`;
        message += `⏰ ${new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}\n\n`;
        message += `⚠️ Qabul qilish uchun botga o'ting ⬇️`;

        for (const group of groups) {
          try {
            // ✅ DEEP LINK orqali qabul qilish (callback_data emas, URL)
            const sentGroupMsg = await bot.sendMessage(group.groupId, message, {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Qabul qilaman",
                      url: `https://t.me/${botInfo.username}?start=accept_${order._id}`,
                    },
                  ],
                ],
              },
            });

            // Guruh xabarini orderga saqlaymiz (keyinchalik o'chirish uchun)
            await Order.findByIdAndUpdate(order._id, {
              $push: {
                groupMessages: {
                  groupId: group.groupId,
                  messageId: sentGroupMsg.message_id,
                },
              },
            });

            await Group.findOneAndUpdate(
              { groupId: group.groupId },
              { $inc: { totalOrders: 1 }, lastActivity: new Date() },
            );

            logger.info(`✅ Guruhga yuborildi: ${group.title}`);
          } catch (err) {
            logger.error(
              `❌ Guruhga yuborishda xato (${group.title}):`,
              err.message,
            );

            if (
              err.message.includes("bot was kicked") ||
              err.message.includes("chat not found")
            ) {
              await Group.findOneAndUpdate(
                { groupId: group.groupId },
                { isActive: false },
              );
              logger.warn(`⚠️ Guruh nofaol qilindi: ${group.title}`);
            }
          }
        }
      } catch (err) {
        logger.error("sendOrderToGroups error:", err);
      }
    }

    module.exports = assignOrder;
  }
}

module.exports = assignOrder;
