// ========== models/Group.model.js ==========
const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    groupId: {
      type: Number,
      unique: true,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["group", "supergroup"],
      default: "group",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    addedBy: {
      type: Number,
      required: true,
    },

    // Statistika
    totalOrders: {
      type: Number,
      default: 0,
    },

    acceptedOrders: {
      type: Number,
      default: 0,
    },

    // Guruh ma'lumotlari
    memberCount: Number,
    description: String,
    inviteLink: String,

    // Admin ma'lumotlari
    lastActivity: {
      type: Date,
      default: Date.now,
    },

    // Sozlamalar
    settings: {
      notifications: { type: Boolean, default: true },
      autoAccept: { type: Boolean, default: false },
      maxDrivers: { type: Number, default: 50 },
    },
  },
  {
    timestamps: true,
  },
);

// ========== INDEXES ==========
GroupSchema.index({ isActive: 1, totalOrders: -1 });
GroupSchema.index({ createdAt: -1 });

// ========== METHODS ==========

// Guruh faolligini yangilash
GroupSchema.methods.updateActivity = function () {
  this.lastActivity = new Date();
  return this.save();
};

// Buyurtma statistikasini yangilash
GroupSchema.methods.incrementOrders = function (accepted = false) {
  this.totalOrders += 1;
  if (accepted) {
    this.acceptedOrders += 1;
  }
  return this.save();
};

// O'rtacha qabul qilish darajasi
GroupSchema.methods.getAcceptanceRate = function () {
  if (this.totalOrders === 0) return 0;
  return ((this.acceptedOrders / this.totalOrders) * 100).toFixed(1);
};

// ========== STATIC METHODS ==========

// Faol guruhlarni olish
GroupSchema.statics.getActiveGroups = function () {
  return this.find({ isActive: true }).sort({ totalOrders: -1 });
};

// Eng faol guruhlar (TOP 10)
GroupSchema.statics.getTopGroups = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ acceptedOrders: -1, totalOrders: -1 })
    .limit(limit);
};

// Nofaol guruhlarni topish (30 kundan ko'p faoliyat yo'q)
GroupSchema.statics.getInactiveGroups = function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.find({
    isActive: true,
    lastActivity: { $lt: thirtyDaysAgo },
  });
};

// ========== VIRTUALS ==========

// Guruh URL
GroupSchema.virtual("url").get(function () {
  return `tg://resolve?domain=${this.groupId}`;
});

// Faollik statusi
GroupSchema.virtual("activityStatus").get(function () {
  const daysSinceActivity = Math.floor(
    (Date.now() - this.lastActivity) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceActivity < 1) return "Juda faol";
  if (daysSinceActivity < 7) return "Faol";
  if (daysSinceActivity < 30) return "O'rtacha";
  return "Nofaol";
});

// ========== MIDDLEWARE ==========

// Guruh o'chirilayotganda
GroupSchema.pre("remove", async function (next) {
  console.log(`🗑️ Guruh o'chirilmoqda: ${this.title}`);
  // Bu yerda qo'shimcha tozalash amallarini bajarish mumkin
  next();
});

// Guruh yaratilayotganda
GroupSchema.post("save", function (doc, next) {
  if (this.isNew) {
    console.log(`✅ Yangi guruh qo'shildi: ${doc.title} (${doc.groupId})`);
  }
  next();
});

// ========== VALIDATION ==========

GroupSchema.path("groupId").validate(function (value) {
  // Telegram group ID manfiy bo'lishi kerak
  return value < 0;
}, "Group ID manfiy bo'lishi kerak");

// ========== EXPORT ==========
module.exports = mongoose.model("group", GroupSchema);
