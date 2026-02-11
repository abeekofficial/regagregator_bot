// ========== models/user.model.js (TO'LIQ TUZATILGAN) ==========
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true },
    username: String,
    role: {
      type: String,
      enum: ["passenger", "driver", "admin"],
      default: null,
    },

    name: String,
    phone: String,

    // Referal fields
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },

    // Rating
    rating: { type: Number, default: 5.0 },
    totalRatings: { type: Number, default: 0 },

    // Driver specific
    driverPhoto: String,
    carModel: String,
    carNumber: String,
    from: String,
    to: String,

    // Status
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockedReason: String,
    blockedAt: Date,

    // Statistics
    completedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },

    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// ✅ AVTOMATIK REFERRAL CODE (ASYNC/AWAIT)
UserSchema.pre("save", async function () {
  if (!this.referralCode) {
    this.referralCode = `REF${this.telegramId}${Date.now().toString(36).toUpperCase()}`;
  }
  // next() ni o'chirish kerak - async funksiyalarda avtomatik
});

// Rating yangilash
UserSchema.methods.updateRating = async function (newRating) {
  this.totalRatings += 1;
  this.rating =
    (this.rating * (this.totalRatings - 1) + newRating) / this.totalRatings;
  await this.save();
};

// Faollikni yangilash
UserSchema.methods.updateActivity = function () {
  this.lastActive = new Date();
  return this.save();
};

module.exports = mongoose.model("User", UserSchema);
