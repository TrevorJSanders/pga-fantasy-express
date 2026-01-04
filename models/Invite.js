const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  leagueId: { type: mongoose.Schema.Types.ObjectId, ref: "League", required: true, index: true},
  email: { type: String, required: true, index: true },
  invitedBy: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined"],
    default: "pending",
  },
  read: { type: Boolean, default: false, index: true },
  token: { type: String },
  createdAt: { type: Date, default: Date.now, expires: '30d' }
})

module.exports = mongoose.model("Invite", inviteSchema, "invites");