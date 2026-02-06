const regions = [
  { name: "Andijon viloyati", code: "andijan" },
  { name: "Buxoro viloyati", code: "bukhara" },
  { name: "Fargʻona viloyati", code: "fergana" },
  { name: "Jizzax viloyati", code: "jizzakh" },
  { name: "Xorazm viloyati", code: "khorezm" },
  { name: "Namangan viloyati", code: "namangan" },
  { name: "Navoiy viloyati", code: "navoiy" },
  { name: "Qashqadaryo viloyati", code: "kashkadarya" },
  { name: "Samarqand viloyati", code: "samarkand" },
  { name: "Sirdaryo viloyati", code: "sirdarya" },
  { name: "Surxondaryo viloyati", code: "surxondaryo" },
  { name: "Toshkent viloyati", code: "tashkent_region" },
  { name: "Toshkent shahri", code: "tashkent_city" },
  { name: "Qoraqalpogʻiston", code: "karakalpakstan" },
];

const createInlineKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: regions.map((r) => [
        { text: r.data, callback_data: `region_${r.code}` },
      ]),
    },
  };
};

module.exports = { regions, createInlineKeyboard };
