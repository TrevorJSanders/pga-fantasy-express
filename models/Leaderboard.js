const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  id: String,
  scorecard: String,
  round: Number,
  startingTee: Number,
  teeTime: Date,
  position: String,
  total: String,
  thru: String,
  scores: {
    type: String,
    default: null // optional
  },
  score: Number
}, { _id: false });

const playerSchema = new mongoose.Schema({
  id: String,
  tournament: String,
  player: String,
  position: String,
  positionValue: Number,
  total: String,
  strokes: String,
  rounds: [roundSchema]
}, { _id: false });

const leaderboardSchema = new mongoose.Schema({
  tournamentId: String,
  lastUpdated: Date,
  id: String,
  sport: String,
  tour: String,
  startDatetime: Date,
  endDatetime: Date,
  name: String,
  slug: String,
  logoUrl: String,
  link: String,
  course: String,
  location: String,
  status: { type: String, enum: ['Completed', 'In Progress', 'Scheduled', 'Paused'] },
  leaderboard: [playerSchema]
});

module.exports = mongoose.model('Leaderboard', leaderboardSchema);