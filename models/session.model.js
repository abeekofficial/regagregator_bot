const SessionSchema = new mongoose.Schema({
  telegramId: Number,
  step: String,
  data: Object,
  expiresAt: { type: Date, default: () => Date.now() + 3600000 },
});

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("Session", SessionSchema);
