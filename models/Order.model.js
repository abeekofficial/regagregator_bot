const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  passengerId: Number,
  driverId: { type: Number, default: null },
  from: String,
  to: String,
  passengers: { type: Number, default: 1 }, // ✅ QO'SHILDI
  departureTime: { type: Date, default: null }, // ✅ QO'SHILDI
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
