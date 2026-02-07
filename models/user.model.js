// ========== models/user.model.js ==========
const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, unique: true, required: true },
    role: { type: String, enum: ["passenger", "driver", "admin"] },

    // Referal fields
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: String, // kim taklif qilgan
    referralCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 }, // passenger uchun bonus

    // Rating (driver priority uchun)
    rating: { type: Number, default: 5.0 },
    totalRatings: { type: Number, default: 0 },

    // Driver ma'lumotlari
    driverPhoto: String, // Telegram file_id
    carModel: String,
    carNumber: String,

    isBlocked: { type: Boolean, default: false },
    completedOrders: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Referal kod generatsiya
UserSchema.pre("save", function (next) {
  if (!this.referralCode) {
    this.referralCode =
      `REF${this.telegramId}${Date.now().toString(36)}`.toUpperCase();
  }
  next();
});

// Rating yangilash
UserSchema.methods.updateRating = async function (newRating) {
  this.totalRatings += 1;
  this.rating =
    (this.rating * (this.totalRatings - 1) + newRating) / this.totalRatings;
  await this.save();
};
