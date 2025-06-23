const mongoose = require('mongoose');

// Round schema for individual round data
const roundSchema = new mongoose.Schema({
  id: { type: String, required: true },
  scorecard: String,
  round: { type: Number, required: true },
  startingTee: Number,
  teeTime: Date,
  position: String,
  total: String,
  thru: String,
  scores: {
    type: String,
    default: null
  },
  score: Number
}, { _id: false });

// Player schema for leaderboard entries
const playerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  tournament: { type: String, required: true },
  player: { type: String, required: true },
  position: String,
  positionValue: Number,
  total: String,
  strokes: String,
  rounds: [roundSchema]
}, { _id: false });

// Main leaderboard schema
const leaderboardSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tournamentId: { type: String, required: true },
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
  timestamps: true,  // Automatically adds createdAt and updatedAt fields
  versionKey: '__v', // Add version key for optimistic concurrency control
  toJSON: {
    transform: function(doc, ret) {
      // Convert _id to id for frontend convenience
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Add indexes for better query performance
leaderboardSchema.index({ tournamentId: 1 });
leaderboardSchema.index({ status: 1 });
leaderboardSchema.index({ slug: 1 });
leaderboardSchema.index({ lastUpdated: -1 });

// Add a pre-save middleware to update lastUpdated
leaderboardSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Leaderboard', leaderboardSchema, 'tournament_leaderboards');