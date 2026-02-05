const mongoose = require("mongoose");

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB ulandi ✅");
  } catch (e) {
    console.log("MongoDB xato ❌", e);
  }
};
