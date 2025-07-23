const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    position: { type: String },
    country: { type: String },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

playerSchema.index({ name: "text" });
playerSchema.index({ name: 1, country: 1 });

module.exports = mongoose.model("Player", playerSchema, "players");
