const mongoose = require("mongoose");

const placementRule = new mongoose.Schema(
  {
    type: { type: String, enum: ["exact", "range"] },
    placement: { type: Number },
    topX: { type: Number },
    points: { type: Number },
  },
  { _id: false }
);

const strokePoints = new mongoose.Schema(
  {
    eagle: { type: Number },
    birdie: { type: Number },
    par: { type: Number },
    bogey: { type: Number },
    doubleBogey: { type: Number },
    holeInOne: { type: Number },
    bogeyFreeRound: { type: Number },
    birdieStreakBonus: { type: Number },
  },
  { _id: false }
);

const bonusPoints = new mongoose.Schema(
  {
    notCut: { type: Number },
    top20Finish: { type: Number },
    beatTop10Player: { type: Number },
    underParAllRounds: { type: Number },
  },
  { _id: false }
);

const rosterRule = new mongoose.Schema(
  {
    type: { type: String, enum: ["open", "draft", "locked"] },
    maxPlayers: { type: Number },
  },
  { _id: false }
);

const startRule = new mongoose.Schema(
  {
    maxPlayers: { type: Number },
    maxStarts: { type: Number },
  },
  { _id: false }
);

const leagueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    createdBy: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    adminUserIds: [{ type: String, ref:"User", required: true}],
    memberUserIds: [{ type: String, ref: "User", required: true}],
    placementPoints: [placementRule],
    strokePoints: strokePoints,
    bonusPoints: bonusPoints,
    scoringFunction: { type: String },
    rosterRule: rosterRule,
    startRule: startRule,
    tournaments: [{ type: String, ref: "Tournament" }],
  },
  { timestamps: true }
);

leagueSchema.index({ "adminUserIds": 1 });
leagueSchema.index({ "memberUserIds": 1 });

module.exports = mongoose.model("League", leagueSchema, "leagues");
