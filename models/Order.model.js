// ========== models/Order.model.js (YANGILANGAN) ==========
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  passengerId: { type: Number, required: true },
  driverId: { type: Number, default: null },
  from: { type: String, required: true },
  to: { type: String, required: true },

  // ✅ Buyurtma turi
  orderType: {
    type: String,
    enum: ["passenger", "cargo"],
    default: "passenger",
  },

  // ✅ Yo'lovchi uchun
  passengers: { type: Number, default: 1, min: 1, max: 4 },

  // ✅ Yuk/Pochta uchun
  cargoDescription: { type: String, default: null },
  cargoPhotoId: { type: String, default: null }, // Telegram file_id

  departureTime: { type: Date, default: null },

  status: {
    type: String,
    enum: [
      "pending",
      "accepted",
      "in_progress",
      "driver_confirmed",
      "passenger_confirmed",
      "completed",
      "cancelled",
    ],
    default: "pending",
  },

  // Vaqt belgilari
  acceptedAt: { type: Date },
  startedAt: { type: Date },
  driverConfirmedAt: { type: Date },
  passengerConfirmedAt: { type: Date },
  completedAt: { type: Date },

  // Guruh xabarlari (o'chirish uchun)
  groupMessages: [
    {
      groupId: Number,
      messageId: Number,
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
