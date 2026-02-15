const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

const defaultEnvPath = path.resolve(process.cwd(), ".env");
const modeEnvPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
}

if (fs.existsSync(modeEnvPath)) {
  dotenv.config({ path: modeEnvPath, override: true });
}

const MONGO_URI =
  process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MONGO_URI,
  ADMIN_IDS: process.env.ADMIN_IDS?.split(",").map(Number) || [],
  TEST_USERS: process.env.TEST_USERS?.split(",").map(Number) || [],
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
};
