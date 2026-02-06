const config = require("./environment");

const features = {
  // Yangi funksiyalarni bu yerda boshqarish
  PAYMENT_SYSTEM: config.IS_DEVELOPMENT, // Faqat test botda
  RATING_SYSTEM: false, // Hali tayyor emas
  ADVANCED_SEARCH: false, // Hali tayyor emas
  REFERRAL_BONUS: false, // Hali tayyor emas
  PUSH_NOTIFICATIONS: config.IS_DEVELOPMENT, // Test rejimida
  DRIVER_LOCATION: false, // Keyinroq qo'shiladi
};

module.exports = {
  features,

  isEnabled(featureName) {
    return features[featureName] || false;
  },

  // Feature ni yoqish/o'chirish
  toggle(featureName, value) {
    if (features.hasOwnProperty(featureName)) {
      features[featureName] = value;
      console.log(`🔧 Feature ${featureName}: ${value ? "ON" : "OFF"}`);
    }
  },

  // Barcha featurelarni ko'rish
  list() {
    return features;
  },
};
