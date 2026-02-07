// ========== bot.js - Registration ==========
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referralCode = match[1]?.trim();

  let user = await User.findOne({ telegramId: chatId });

  // Eski user
  if (user && user.role) {
    return showMainMenu(bot, chatId, user);
  }

  // Yangi user
  if (!user) {
    user = await User.create({
      telegramId: chatId,
      username: msg.from.username,
    });
  }

  // Referal bilan kelgan bo'lsa
  let referralInfo = "";
  if (referralCode && referralCode.startsWith("REF")) {
    const result = await handleReferral(bot, msg, referralCode);
    if (result.success) {
      if (result.inviterRole === "passenger") {
        referralInfo = `\n\n🎁 ${result.inviterName} sizni taklif qildi!\n💰 Siz ro'yxatdan o'tgach, u 5000 so'm bonus oladi!`;
      } else {
        referralInfo = `\n\n🚗 Haydovchi ${result.inviterName} sizni taklif qildi!`;
      }
    }
  }

  bot.sendMessage(
    chatId,
    `🚕 Taksi botga xush kelibsiz!${referralInfo}\n\nKim sifatida kirmoqchisiz?`,
    {
      reply_markup: {
        keyboard: [["🚕 Haydovchi", "🧍 Yo'lovchi"]],
        resize_keyboard: true,
      },
    },
  );
});

// Driver registration - RASM QABUL QILISH
bot.on("message", async (msg) => {
  const session = await Session.findOne({ telegramId: msg.chat.id });

  if (session?.step === "DRIVER_PHOTO") {
    if (!msg.photo) {
      return bot.sendMessage(msg.chat.id, "❌ Iltimos rasm yuboring!");
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;

    await User.findOneAndUpdate(
      { telegramId: msg.chat.id },
      { driverPhoto: fileId },
    );

    session.step = "DRIVER_FROM";
    await session.save();

    bot.sendMessage(
      msg.chat.id,
      "📍 Qayerdan yo'lovchi olib ketasiz?",
      createInlineKeyboard(),
    );
  }
});

// Registration tugaganda - REFERAL LINK
async function showWelcomeMessage(bot, chatId, user) {
  const botUsername = (await bot.getMe()).username;
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

  let message = `✅ Ro'yxatdan o'tdingiz!\n\n`;

  if (user.role === "passenger") {
    message += `🎁 REFERAL DASTURI:\n`;
    message += `Do'stlaringizni taklif qiling va har biri uchun 5000 so'm bonus oling!\n\n`;
    message += `📎 Sizning havolangiz:\n${referralLink}\n\n`;
    message += `💰 Joriy balans: ${user.referralEarnings} so'm`;
  } else {
    message += `🚗 REFERAL DASTURI:\n`;
    message += `Do'stlaringizni taklif qiling - buyurtma prioritetingiz oshadi!\n\n`;
    message += `📎 Sizning havolangiz:\n${referralLink}\n\n`;
    message += `📊 Taklif qilganlar: ${user.referralCount} ta\n`;
    message += `⭐ Rating: ${user.rating.toFixed(1)}\n\n`;
    message += `⚠️ DIQQAT:\n`;
    message += `- 3 marta rad etsangiz - bloklanasiz\n`;
    message += `- Reytingingiz 3.0 dan past bo'lsa - tekshirilasiz`;
  }

  bot.sendMessage(chatId, message);
}
