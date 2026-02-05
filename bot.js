require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const connectDB = require("./config/db");
const User = require("./models/user.model");

connectDB();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", (msg) => {
  console.log("Xabar keldi:", msg.text);
});

bot.onText(/\/start(.*)/, async (msg) => {
  const chatId = msg.chat.id;

  console.log("START bosildi:", chatId); // 👈 debug uchun

  let user = await User.findOne({ telegramId: chatId });
  if (!user) {
    await User.create({
      telegramId: chatId,
    });
  }

  bot.sendMessage(
    chatId,
    "🚕 Taksi botga xush kelibsiz!\nKim sifatida kirmoqchisiz?",
    {
      reply_markup: {
        keyboard: [["🚕 Haydovchi", "🧍 Yo‘lovchi"]],
        resize_keyboard: true,
      },
    },
  );
});
