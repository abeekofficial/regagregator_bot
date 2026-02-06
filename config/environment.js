const path = require("path");

// Environment faylini yuklash
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

require("dotenv").config({ path: path.resolve(process.cwd(), envFile) });

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MONGO_URI: process.env.MONGO_URI,
  ADMIN_IDS: process.env.ADMIN_IDS?.split(",").map(Number) || [],
  TEST_USERS: process.env.TEST_USERS?.split(",").map(Number) || [],
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
};
