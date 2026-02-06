const config = require("../config/environment");

module.exports = {
  isAdmin: (id) => config.ADMIN_IDS.includes(id),
  isTestUser: (id) => config.TEST_USERS.includes(id),
  isSuperAdmin: (id) => id === config.ADMIN_IDS[0], // Birinchi admin
};
