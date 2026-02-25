const { Telegraf } = require("telegraf");
const {message} = require("telegraf/filters")
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  console.log(userId);
})

