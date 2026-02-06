const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  passengerId: Number,
  from: String,
  to: String,
  price: Number,
  status: {
    type: String,
    enum: ["pending", "accepted", "done", "cancelled"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
