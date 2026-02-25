// ========== config/database.js ==========
const mongoose = require("mongoose");
const config = require("./environment");
const logger = require("../utils/logger");

async function connectDB() {
  try {
    mongoose.set("bufferCommands", false);

    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    logger.success(
      `MongoDB ulandi [${config.NODE_ENV.toUpperCase()}]`,
      config.MONGO_URI.split("@")[1]?.split("?")[0],
    );

    // Connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warning("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.success("MongoDB reconnected");
    });

    return mongoose.connection;
  } catch (err) {
    logger.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
