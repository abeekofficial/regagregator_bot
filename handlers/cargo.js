// ========== handlers/cargo.js (YUK/POCHTA - TO'LIQ) ==========
const Session = require("../models/session.model");
const Order = require("../models/Order.model");
const User = require("../models/user.model");
const { createInlineKeyboard } = require("../utils/regionOptions");
const assignOrder = require("./orderAssign");
const logger = require("../utils/logger");
const { showMainMenu } = require("./menu");

module.exports = (bot) => {
  // ========== 1️⃣ YUK/POCHTA BUYURTMA BOSHLASH ==========
  bot.onText(/📦 Yuk\/Pochta/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      // Faqat shaxsiy chatda
      if (msg.chat.type !== "private") return;

      const user = await User.findOne({ telegramId: chatId });
      if (!user || !user.role) {
        return bot.sendMessage(chatId, "❌ Avval ro'yxatdan o'ting! /start");
      }

      await Session.deleteMany({ telegramId: chatId });
      await Session.create({
        telegramId: chatId,
        step: "CARGO_FROM_REGION",
        data: { role: "cargo" },
      });

      logger.info("Yuk buyurtma boshladi:", chatId);

      await bot.sendMessage(
        chatId,
        "📦 YUK/POCHTA YUBORISH\n\n📍 Qayerdan jo'natmoqchisiz?",
        createInlineKeyboard(),
      );
    } catch (err) {
      logger.error("Cargo start error:", err);
      bot.sendMessage(chatId, "❌ Xatolik yuz berdi");
    }
  });

  // ========== 2️⃣ CALLBACK QUERY (REGION TANLASH) ==========
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Faqat shaxsiy chatda
    if (query.message.chat.type !== "private") return;

    try {
      const session = await Session.findOne({ telegramId: chatId });

      if (!session || session.data?.role !== "cargo") return;

      // FROM viloyat tanlash
      if (data.startsWith("region_") && session.step === "CARGO_FROM_REGION") {
        const regionCode = data.replace("region_", "");

        session.data.from = regionCode;
        session.step = "CARGO_TO_REGION";
        session.markModified("data");
        await session.save();

        await bot.answerCallbackQuery(query.id);

        return bot.sendMessage(
          chatId,
          "📍 Qayerga yubormoqchisiz?",
          createInlineKeyboard(),
        );
      }

      // TO viloyat tanlash
      if (data.startsWith("region_") && session.step === "CARGO_TO_REGION") {
        const regionCode = data.replace("region_", "");

        session.data.to = regionCode;
        session.step = "CARGO_DESCRIPTION";
        session.markModified("data");
        await session.save();

        await bot.answerCallbackQuery(query.id);

        return bot.sendMessage(
          chatId,
          "📝 Yuk haqida ma'lumot yozing:\n\n" +
            "Masalan: 20 kg un, kichik quti, hujjatlar, kiyim-kechak...\n\n" +
            "⬇️ Matn yuboring:",
        );
      }
    } catch (err) {
      logger.error("Cargo callback error:", err);
      try {
        await bot.answerCallbackQuery(query.id, {
          text: "❌ Xatolik!",
          show_alert: true,
        });
      } catch (e) {}
    }
  });

  // ========== 3️⃣ MATN XABARLAR (DESCRIPTION VA RASM) ==========
  bot.on("message", async (msg) => {
    // Faqat shaxsiy chatda
    if (msg.chat.type !== "private") return;

    const chatId = msg.chat.id;

    try {
      const session = await Session.findOne({ telegramId: chatId });

      if (!session || session.data?.role !== "cargo") return;

      // ========== YUK TAVSIFI ==========
      if (session.step === "CARGO_DESCRIPTION") {
        if (!msg.text) {
          return bot.sendMessage(
            chatId,
            "⚠️ Iltimos, matn yuboring (yuk tavsifi)",
          );
        }

        session.data.description = msg.text;
        session.step = "CARGO_PHOTO";
        session.markModified("data");
        await session.save();

        return bot.sendMessage(
          chatId,
          "📸 Yuk rasmini yuboring:\n\n" +
            "Bu haydovchiga yukni tanishda yordam beradi.\n\n" +
            "Agar rasm bo'lmasa — /skip yozing",
          {
            reply_markup: {
              keyboard: [["Rasmni o'tkazib yuborish"]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
      }

      // ========== RASM YUKLASH ==========
      if (session.step === "CARGO_PHOTO") {
        // /skip yoki matn bo'lsa
        if (
          msg.text &&
          (msg.text === "/skip" || msg.text.includes("o'tkazib"))
        ) {
          session.data.photoId = null;
          session.markModified("data");
          await session.save();

          await createCargoOrder(bot, chatId, session);
          return;
        }

        // Rasm keldi
        if (msg.photo && msg.photo.length > 0) {
          // Eng katta o'lchamdagi rasmni olish
          const photo = msg.photo[msg.photo.length - 1];
          session.data.photoId = photo.file_id;
          session.markModified("data");
          await session.save();

          await createCargoOrder(bot, chatId, session);
          return;
        }

        // Boshqa narsa yuborilgan
        return bot.sendMessage(
          chatId,
          "⚠️ Iltimos, rasm yuboring yoki /skip yozing",
        );
      }
    } catch (err) {
      logger.error("Cargo message error:", err);
    }
  });
};

// ========== HELPER: BUYURTMA YARATISH VA YUBORISH ==========
async function createCargoOrder(bot, chatId, session) {
  try {
    const data = session.data;

    const order = await Order.create({
      passengerId: chatId,
      from: data.from,
      to: data.to,
      orderType: "cargo",
      cargoDescription: data.cargoDescription,
      cargoPhotoId: data.photoId || null,
      passengers: 1,
    });

    await Session.deleteMany({ telegramId: chatId });

    logger.info("Yuk buyurtma yaratildi:", {
      orderId: order._id,
      from: order.from,
      to: order.to,
    });

    // Foydalanuvchiga tasdiqlash xabari
    const confirmText =
      `✅ YUK BUYURTMANGIZ QABUL QILINDI!\n\n` +
      `📍 ${order.from} ➝ ${order.to}\n` +
      `📝 Yuk: ${order.cargoDescription}\n` +
      (data.photoId ? `📸 Rasm: ✅ Qo'shildi\n` : `📸 Rasm: Yo'q\n`) +
      `\n⏳ Haydovchi izlanmoqda...`;

    if (data.photoId) {
      await bot.sendPhoto(chatId, data.photoId, { caption: confirmText });
    } else {
      await bot.sendMessage(chatId, confirmText);
    }

    // Assign qilish (haydovchilarga yuborish)
    assignOrder(bot, order._id);

    const user = await require("../models/user.model").findOne({
      telegramId: chatId,
    });
    if (user) await showMainMenu(bot, chatId, user);
  } catch (err) {
    logger.error("createCargoOrder error:", err);
    bot.sendMessage(chatId, "❌ Buyurtma yaratishda xatolik yuz berdi");
  }
}
