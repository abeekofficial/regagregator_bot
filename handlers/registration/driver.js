// ========== handlers/registration/driver.js ==========
const User = require("../../models/user.model");
const Session = require("../../models/session.model");
const logger = require("../../utils/logger");
const { createInlineKeyboard } = require("../../utils/regionOptions");

async function handleMessage(bot, msg, session) {
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    // ========== ISM ==========
    if (session.step === "DRIVER_NAME") {
      session.data = session.data || {};
      session.data.name = text;
      session.step = "DRIVER_PHONE";
      await session.save();

      logger.debug("Driver name:", session.data.name);

      return bot.sendMessage(chatId, "📱 Telefon raqamingizni kiriting:", {
        reply_markup: {
          keyboard: [
            [
              {
                text: "📱 Telefon raqamni yuborish",
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
        },
      });
    }

    // ========== TELEFON ==========
    if (session.step === "DRIVER_PHONE") {
      const phone = msg.contact ? msg.contact.phone_number : text;

      session.data = session.data || {};
      session.data.phone = phone;
      session.step = "DRIVER_PHOTO";
      await session.save();

      logger.debug("Driver phone:", session.data.phone);

      return bot.sendMessage(
        chatId,
        "📸 O'zingiz va mashinangiz rasmi bilan bitta RASM yuboring:",
        { reply_markup: { remove_keyboard: true } },
      );
    }

    // ========== RASM ==========
    if (session.step === "DRIVER_PHOTO") {
      if (!msg.photo) {
        return bot.sendMessage(chatId, "❌ Iltimos rasm yuboring!");
      }

      const fileId = msg.photo[msg.photo.length - 1].file_id;

      session.data = session.data || {};
      session.data.driverPhoto = fileId;
      session.step = "DRIVER_CAR_MODEL";
      await session.save();

      logger.debug("Driver photo:", session.data.driverPhoto);

      return bot.sendMessage(
        chatId,
        "🚗 Mashina modelingizni kiriting:\n(Masalan: Chevrolet Lacetti)",
      );
    }

    // ========== MASHINA MODELI ==========
    if (session.step === "DRIVER_CAR_MODEL") {
      session.data = session.data || {};
      session.data.carModel = text;
      session.step = "DRIVER_CAR_NUMBER";
      await session.save();

      logger.debug("Car model:", session.data.carModel);

      return bot.sendMessage(
        chatId,
        "🔢 Mashina raqamingizni kiriting:\n(Masalan: 01 A 777 AA)",
      );
    }

    // ========== MASHINA RAQAMI ==========
    if (session.step === "DRIVER_CAR_NUMBER") {
      session.data = session.data || {};
      session.data.carNumber = text;
      session.step = "DRIVER_FROM";
      await session.save();

      logger.debug("Car number:", session.data.carNumber);

      return bot.sendMessage(
        chatId,
        "✅ Malumotlaringiz saqlandi endi buyurtma qabul qilishni boshlashingiz mumkin !",
      );
    }
  } catch (err) {
    logger.error("Driver message handler error:", err);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi, qaytadan urinib ko'ring");
  }
}

async function handleCallback(bot, query, session) {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (!data.startsWith("region_")) return;

    const regionCode = data.replace("region_", "");

    // ========== FROM TANLANDI ==========
    if (session.step === "DRIVER_FROM") {
      session.data = session.data || {};
      session.data.from = regionCode;
      session.step = "DRIVER_TO";
      await session.save();

      logger.debug("Driver FROM:", session.data.from);

      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(
        chatId,
        "📍 Qayerga yo'lovchi olib borasiz?",
        createInlineKeyboard(),
      );
    }

    // ========== TO TANLANDI ==========
    if (session.step === "DRIVER_TO") {
      session.data = session.data || {};
      session.data.to = regionCode;
      await session.save();

      logger.debug("Driver TO:", session.data.to);

      // ✅ USER YARATISH/YANGILASH
      const user = await User.findOneAndUpdate(
        { telegramId: chatId },
        {
          $set: {
            role: session.data.role || "driver",
            name: session.data.name,
            phone: session.data.phone,
            driverPhoto: session.data.driverPhoto,
            carModel: session.data.carModel,
            carNumber: session.data.carNumber,
            from: session.data.from,
            to: session.data.to,
            isActive: true,
          },
        },
        { new: true },
      );

      // ✅ SESSION TOZALASH
      // pendingOrderId ni saqlab olamiz (guruhdan kelgan bo'lsa)
      const pendingSession = await Session.findOne({
        telegramId: chatId,
        step: "PENDING_ORDER_ACCEPT",
      });
      const pendingOrderId = pendingSession?.data?.pendingOrderId || null;

      await Session.deleteMany({ telegramId: chatId });

      logger.success("Haydovchi ro'yxatdan o'tdi:", {
        id: chatId,
        name: user.name,
        car: `${user.carModel} (${user.carNumber})`,
        route: `${user.from} → ${user.to}`,
      });

      await bot.answerCallbackQuery(query.id);

      // ✅ REFERAL CODE YARATISH
      if (!user.referralCode) {
        user.referralCode = `REF${user.telegramId}${Date.now().toString(36).toUpperCase()}`;
        await user.save();
      }

      const botInfo = await bot.getMe();
      const referralLink = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

      // ✅ WELCOME MESSAGE
      let welcomeMsg = `✅ RO'YXATDAN O'TDINGIZ!\n\n`;
      welcomeMsg += `👤 Ism: ${user.name}\n`;
      welcomeMsg += `📱 Telefon: ${user.phone}\n`;
      welcomeMsg += `🚙 Mashina: ${user.carModel}\n`;
      welcomeMsg += `🔢 Raqam: ${user.carNumber}\n`;

      welcomeMsg += `🚗 REFERAL DASTURI:\n`;
      welcomeMsg += `Do'stlaringizni taklif qiling - prioritetingiz oshadi!\n\n`;
      welcomeMsg += `📎 Sizning havolangiz:\n${referralLink}\n\n`;
      welcomeMsg += `📊 Referallar: ${user.referralCount || 0} ta\n`;
      welcomeMsg += `⭐ Rating: ${user.rating?.toFixed(1) || 5.0}\n\n`;

      welcomeMsg += `⚠️ MUHIM:\n`;
      welcomeMsg += `• 3 marta rad etsangiz - bloklanasiz\n`;
      welcomeMsg += `• Rating < 3.0 - admin tekshiradi\n`;
      welcomeMsg += `• Priority: Referal → Rating`;

      await bot.sendMessage(chatId, welcomeMsg, {
        reply_markup: {
          keyboard: [["📋 Buyurtmalar"], ["👤 Profilim"]],
          resize_keyboard: true,
        },
      });

      // ========== GURUHDAN KELGAN BO'LSA - PENDING ORDER QABUL QILISH ==========
      if (pendingOrderId) {
        try {
          const Order = require("../../models/Order.model");
          const order = await Order.findById(pendingOrderId);

          if (!order || order.status !== "pending" || order.driverId) {
            await bot.sendMessage(
              chatId,
              "❌ Buyurtma allaqachon qabul qilingan!",
            );
          } else {
            await Order.findByIdAndUpdate(pendingOrderId, {
              driverId: chatId,
              status: "accepted",
              acceptedAt: new Date(),
            });

            // Guruh xabarlarini o'chirish
            if (order.groupMessages && order.groupMessages.length > 0) {
              for (const gm of order.groupMessages) {
                try {
                  await bot.deleteMessage(gm.groupId, gm.messageId);
                } catch (e) {}
              }
            }

            // Passengerga xabar
            const passenger = await User.findOne({
              telegramId: order.passengerId,
            });
            if (passenger) {
              await bot.sendMessage(
                passenger.telegramId,
                `🚗 HAYDOVCHI TOPILDI!\n\n` +
                  `👤 ${user.name}\n` +
                  `📱 ${user.phone}\n` +
                  `🚙 ${user.carModel}\n` +
                  `🔢 ${user.carNumber}\n` +
                  `⭐ Rating: ${user.rating?.toFixed(1) || "5.0"}\n\n` +
                  `📞 Haydovchi bilan bog'laning!\n\n` +
                  `⏳ Safar boshlanishini kuting...`,
              );
            }

            const typeIcon = order.orderType === "cargo" ? "📦" : "👥";
            const typeText =
              order.orderType === "cargo"
                ? `Yuk: ${order.cargoDescription}`
                : `${order.passengers || 1} kishi`;

            await bot.sendMessage(
              chatId,
              `✅ BUYURTMA QABUL QILINDI!\n\n` +
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
                        callback_data: `start_trip_${pendingOrderId}`,
                      },
                    ],
                  ],
                },
              },
            );

            logger.info(
              `Ro'yxatdan keyin buyurtma qabul qilindi: ${pendingOrderId} by ${chatId}`,
            );
          }
        } catch (pendingErr) {
          logger.error("Pending order xatosi:", pendingErr);
        }
      }
    }
  } catch (err) {
    logger.error("Driver callback error:", err);
    await bot.answerCallbackQuery(query.id, {
      text: "❌ Xatolik!",
      show_alert: true,
    });
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi, /start bosing");
  }
}

module.exports = { handleMessage, handleCallback };
