const regions = [
  { name: "Andijon v.", code: "andijan" },
  { name: "Buxoro v.", code: "bukhara" },
  { name: "Fargʻona v.", code: "fergana" },
  { name: "Jizzax v.", code: "jizzakh" },
  { name: "Xorazm v.", code: "khorezm" },
  { name: "Namangan v.", code: "namangan" },
  { name: "Navoiy v.", code: "navoiy" },
  { name: "Qashqadaryo v.", code: "kashkadarya" },
  { name: "Samarqand v.", code: "samarkand" },
  { name: "Sirdaryo v.", code: "sirdarya" },
  { name: "Surxondaryo v.", code: "surxondaryo" },
  { name: "Toshkent v.", code: "tashkent_region" },
  { name: "Toshkent sh.", code: "tashkent_city" },
  { name: "Qoraqalpogʻiston", code: "karakalpakstan" },
];

const createInlineKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: regions.map((r) => [
        { text: r.name, callback_data: `region_${r.code}` },
      ]),
      resize_keyboard: true,
    },
  };
};

module.exports = { regions, createInlineKeyboard };
