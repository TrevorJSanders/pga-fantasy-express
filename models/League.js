const mongoose = require("mongoose");

const leagueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  adminUserIds: [{ type: String, required: true }],
  memberUserIds: [{ type: String, required: true }],
  scoringSettings: {
    placementPoints: [
      {
        type: {type: String},
        placement: {type: Number},
        topX: {type: Number},
        points: {type: Number},
      },
    ],
    strokePoints: {
      eagle: Number,
      birdie: Number,
      par: Number,
      bogey: Number,
      doubleBogey: Number,
      holeInOne: Number,
      bogeyFreeRound: Number,
      birdieStreakBonus: Number,
    },
    bonusPoints: {
      notCut: Number,
      top20Finish: Number,
      beatTop10Player: Number,
      underParAllRounds: Number,
    },
    scoringFunction: { type: String },
  },
});

module.exports = mongoose.model("League", leagueSchema, "leagues");
