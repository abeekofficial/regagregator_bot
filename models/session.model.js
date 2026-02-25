const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true },
    step: { type: String, required: true },

    // ❌ ESKI (Mixed type - muammoli)
    // data: Object,

    // ✅ YANGI (Structured fields)
    data: {
      role: String,
      name: String,
      phone: String,
      driverPhoto: String,
      carModel: String,
      carNumber: String,
      from: String,
      to: String,
      passengerCount: Number,
      cargoWeight: Number,
      cargoDescription: String,
      cargoPhotoId: String,
      orderType: String,
      pendingOrderId: String,
    },

    expiresAt: { type: Date, default: () => Date.now() + 3600000 },
  },
  { timestamps: true },
);

// TTL index
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", SessionSchema);
