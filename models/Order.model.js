const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  passengerId: Number,
  driverId: { type: Number, default: null },
  from: String,
  to: String,

  // ✅ Buyurtma turi: yo'lovchi yoki yuk
  orderType: {
    type: String,
    enum: ["passenger", "cargo"],
    default: "passenger",
  },

  // ✅ Yo'lovchi uchun
  passengers: { type: Number, default: 1 },

  // ✅ Yuk uchun (kg da)
  cargoWeight: { type: Number, default: null },

  departureTime: { type: Date, default: null },

  status: {
    type: String,
    enum: ["pending", "accepted", "in_progress", "completed", "cancelled"],
    default: "pending",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
