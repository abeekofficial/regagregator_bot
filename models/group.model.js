// ========== models/Group.model.js ==========
const GroupSchema = new mongoose.Schema(
  {
    groupId: { type: Number, unique: true },
    title: String,
    isActive: { type: Boolean, default: true },
    addedBy: Number, // admin telegram ID
    totalOrders: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Group", GroupSchema);
