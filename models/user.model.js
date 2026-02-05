const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, unique: true },
    role: String,

    name: String,
    phone: String,

    from: String,
    to: String,

    carModel: String,
    carNumber: String,

    referralCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    cancelCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
