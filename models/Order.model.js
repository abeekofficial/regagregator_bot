const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    passengerId: Number,
    driverId: Number,

    from: String,
    to: String,

    status: {
      type: String,
      default: "pending",
    },

    offeredDrivers: [Number],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);
