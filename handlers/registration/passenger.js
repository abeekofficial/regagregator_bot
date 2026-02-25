// ========== handlers/registration/passenger.js ==========
const User = require("../../models/user.model");
const Session = require("../../models/session.model");
const logger = require("../../utils/logger");

async function handleMessage(bot, msg, session) {
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    // ========== ISM ==========
    if (session.step === "PASSENGER_NAME") {
      session.data = session.data || {};
      session.data.name = text;
      session.step = "PASSENGER_PHONE";
      await session.save();

      logger.debug("Passenger name:", session.data.name);

      return bot.sendMessage(
        chatId,
        "📱 Telefon raqamingizni kiriting:\n(Masalan: +998901234567)",
        {
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
        },
      );
    }

    // ========== TELEFON ==========
    if (session.step === "PASSENGER_PHONE") {
      const phone = msg.contact ? msg.contact.phone_number : text;

      session.data = session.data || {};
      session.data.phone = phone;
      await session.save();

      logger.debug("Passenger phone:", session.data.phone);

      // ✅ USER YARATISH/YANGILASH
      const user = await User.findOneAndUpdate(
        { telegramId: chatId },
        {
          $set: {
            role: "passenger",
            name: session.data.name,
            phone: session.data.phone,
          },
        },
        { new: true },
      );

      // ✅ SESSION TOZALASH
      await Session.deleteMany({ telegramId: chatId });

      logger.success("Yo'lovchi ro'yxatdan o'tdi:", {
        id: chatId,
        name: user.name,
      });

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
      welcomeMsg += `📱 Telefon: ${user.phone}\n\n`;
      welcomeMsg += `🎁 REFERAL DASTURI:\n`;
      welcomeMsg += `Do'stlaringizni taklif qiling va har biri uchun 5000 so'm bonus oling!\n\n`;
      welcomeMsg += `📎 Sizning havolangiz:\n${referralLink}\n\n`;
      welcomeMsg += `💰 Joriy balans: ${user.referralEarnings || 0} so'm`;

      return bot.sendMessage(chatId, welcomeMsg, {
        reply_markup: {
          keyboard: [["🚖 Buyurtma berish"], ["👤 Profilim"]],
          resize_keyboard: true,
        },
      });
    }
  } catch (err) {
    logger.error("Passenger registration error:", err);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi, qaytadan urinib ko'ring");
  }
}

module.exports = { handleMessage };
