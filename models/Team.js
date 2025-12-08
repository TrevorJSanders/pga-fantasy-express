const mongoose = require("mongoose");

const teamSchema = new mongoose.mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true, index: true },
    leagueId: { type: mongoose.Schema.Types.ObjectId, ref: "League", required: true, index: true },
    name: { type: String, default: "My Team" },
    playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    playerUsage: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  { timestamps: true }
);

teamSchema.index({ userId: 1, leagueId: 1 }, { unique: true });

module.exports = mongoose.model("Team", teamSchema, "teams");
