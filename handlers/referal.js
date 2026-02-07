// ========== handlers/referal.js ==========
const User = require("../models/user.model");

// /start REF123ABC formatida kelganda
async function handleReferral(bot, msg, referralCode) {
  const chatId = msg.chat.id;

  try {
    // Referal koddan inviter topish
    const inviter = await User.findOne({ referralCode });

    if (!inviter) {
      return { success: false, message: "❌ Noto'g'ri referal kod" };
    }

    // Yangi user yaratish
    const newUser = await User.create({
      telegramId: chatId,
      referredBy: referralCode,
      username: msg.from.username,
    });

    // Inviter statistikasini yangilash
    inviter.referralCount += 1;

    // PASSENGER taklif qilgan bo'lsa - bonus
    if (inviter.role === "passenger") {
      inviter.referralEarnings += 5000; // 5000 so'm
      await bot.sendMessage(
        inviter.telegramId,
        `🎉 Yangi foydalanuvchi sizning havolangiz orqali qo'shildi!\n💰 Bonus: 5000 so'm`,
      );
    }

    // DRIVER taklif qilgan bo'lsa - priority oshadi
    if (inviter.role === "driver") {
      await bot.sendMessage(
        inviter.telegramId,
        `🎉 Yangi foydalanuvchi sizning havolangiz orqali qo'shildi!\n📊 Buyurtma prioritetingiz oshdi (${inviter.referralCount} ta)`,
      );
    }

    await inviter.save();

    return {
      success: true,
      inviterName: inviter.name,
      inviterRole: inviter.role,
    };
  } catch (err) {
    console.error("Referal error:", err);
    return { success: false };
  }
}

module.exports = { handleReferral };
