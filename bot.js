require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");

const User = require("./models/user.model");
const state = require("./utils/state");

mongoose.set("bufferCommands", false);

async function startBot() {
  try {
    // 1️⃣ MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB ulandi ✅");

    // 2️⃣ BOTNI YARATISH
    const bot = new TelegramBot(process.env.BOT_TOKEN, {
      polling: true,
    });

    console.log("Bot ishga tushdi 🚀");

    // 3️⃣ DEBUG
    bot.on("message", (msg) => {
      console.log("Xabar keldi:", msg.text);
    });

    // 4️⃣ /start
    bot.onText(/\/start(.*)/, async (msg) => {
      const chatId = msg.chat.id;
      console.log("START bosildi:", chatId);

      let user = await User.findOne({ telegramId: chatId });
      if (!user) {
        await User.create({ telegramId: chatId });
      }

      bot.sendMessage(
        chatId,
        "🚕 Assalamu aleykum Taksi botga xush kelibsiz!\nKim sifatida kirmoqchisiz?",
        {
          reply_markup: {
            keyboard: [["🚕 Haydovchi", "🧍 Yo‘lovchi"]],
            resize_keyboard: true,
          },
        },
      );
    });

    // 5️⃣ ROLE TANLASH
    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (text === "🧍 Yo‘lovchi") {
        state.set(chatId, "PASSENGER_NAME");
        return bot.sendMessage(chatId, "👤 Ism Familiyangizni kiriting:");
      }

      if (text === "🚕 Haydovchi") {
        state.set(chatId, "DRIVER_NAME");
        return bot.sendMessage(chatId, "👤  Ism Familiyangizni kiriting:");
      }
    });
  } catch (err) {
    console.error("❌ BOT START XATOSI:", err.message);
    process.exit(1);
  }
}

startBot();
