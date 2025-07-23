const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  id: { type: String, required: true },
  scorecard: String,
  round: { type: Number, required: true },
  startingTee: Number,
  teeTime: Date,
  position: String,
  total: String,
  thru: String,
  scores: { type: String, default: null },
  score: Number
}, { _id: false });

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true }, // external player ID
  tournament: { type: String, required: true },
  player: { type: String, required: true },
  position: String,
  positionValue: Number,
  total: String,
  strokes: String,
  rounds: [roundSchema]
}, { _id: false });

const leaderboardSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // leaderboard id (could match tournamentId or be unique)
  tournamentId: { type: String, ref: "Tournament", required: true }, // ref to tournament _id
  sport: String,
  tour: String,
  startDatetime: Date,
  endDatetime: Date,
  name: { type: String, required: true },
  slug: String,
  logoUrl: String,
  link: String,
  course: String,
  location: String,
  status: { 
    type: String, 
    enum: ['Completed', 'In Progress', 'Scheduled', 'Paused'],
    default: 'Scheduled'
  },
  lastUpdated: { type: Date, default: Date.now },
  leaderboard: [playerSchema]
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

// Indexes
leaderboardSchema.index({ tournamentId: 1 });
leaderboardSchema.index({ status: 1 });
leaderboardSchema.index({ slug: 1 });
leaderboardSchema.index({ lastUpdated: -1 });

leaderboardSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Leaderboard', leaderboardSchema, 'tournament_leaderboards');
