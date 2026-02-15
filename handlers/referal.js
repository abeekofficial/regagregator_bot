// ========== handlers/referal.js ==========
const User = require("../models/user.model");

async function handleReferral(bot, msg, referralCode) {
  const chatId = msg.chat.id;

  try {
    // Referal koddan inviter topish
    const inviter = await User.findOne({ referralCode });

    if (!inviter) {
      return { success: false, message: "❌ Noto'g'ri referal kod" };
    }

    // ✅ USER ALLAQACHON MAVJUD BO'LISHI MUMKIN
    let newUser = await User.findOne({ telegramId: chatId });

    if (!newUser) {
      // Yangi user yaratish
      newUser = await User.create({
        telegramId: chatId,
        referredBy: referralCode,
        username: msg.from.username,
      });
      console.log("✅ Yangi user yaratildi (referal):", chatId);
    } else {
      // Mavjud userga referralBy qo'shish
      newUser.referredBy = referralCode;
      await newUser.save();
      console.log("✅ Mavjud userga referal qo'shildi:", chatId);
    }

    // Inviter statistikasini yangilash
    inviter.referralCount += 1;

    // PASSENGER taklif qilgan bo'lsa - bonus
    if (inviter.role === "passenger") {
      inviter.referralEarnings += 5000; // 5000 so'm
      await bot.sendMessage(
        inviter.telegramId,
        `🎉 Yangi foydalanuvchi sizning havolangiz orqali qo'shildi!`,
      );
    }

    // DRIVER taklif qilgan bo'lsa - priority oshadi
    if (inviter.role === "driver") {
      await bot.sendMessage(
        inviter.telegramId,
        `🎉 Yangi foydalanuvchi sizning havolangiz orqali qo'shildi!\n📊 Buyurtma prioritetingiz oshdi!\n\n👥 Jami referallar: ${inviter.referralCount} ta`,
      );
    }

    await inviter.save();

    return {
      success: true,
      inviterName: inviter.name || inviter.username || "Foydalanuvchi",
      inviterRole: inviter.role,
    };
  } catch (err) {
    console.error("❌ Referal error:", err);
    return { success: false };
  }
}

module.exports = { handleReferral };
