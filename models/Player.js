const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    position: { type: String },
    country: { type: String },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

playerSchema.index({ name: "text" });
playerSchema.index({ _id: 1 });

const Player = mongoose.model("Player", playerSchema, "players");
module.exports = Player;
