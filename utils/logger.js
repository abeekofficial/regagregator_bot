const config = require("../config/environment");

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

module.exports = {
  info(message, data = "") {
    if (config.IS_DEVELOPMENT) {
      console.log(`${colors.blue}ℹ️  INFO:${colors.reset}`, message, data);
    }
  },

  success(message, data = "") {
    console.log(`${colors.green}✅ SUCCESS:${colors.reset}`, message, data);
  },

  error(message, error = "") {
    console.error(`${colors.red}❌ ERROR:${colors.reset}`, message, error);
  },

  warn(message, data = "") {
    console.warn(`${colors.yellow}⚠️  WARNING:${colors.reset}`, message, data);
  },

  debug(message, data = "") {
    if (config.IS_DEVELOPMENT) {
      console.log(`${colors.magenta}🐛 DEBUG:${colors.reset}`, message, data);
    }
  },

  feature(featureName, enabled) {
    console.log(
      `${colors.cyan}🔧 FEATURE:${colors.reset}`,
      featureName,
      enabled ? "✅ ON" : "❌ OFF",
    );
  },
};
