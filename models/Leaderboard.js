const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  id: string,
  scorecard: string,
  round: number,
  startingTee: number,
  teeTime: Date,
  position: string,
  total: string,
  thru: string,
  scores: string | null,
  score: number
}, { _id: false });

const playerSchema = new mongoose.Schema({
  id: string,
  tournament: string,
  player: string,
  position: string,
  positionValue: number,
  total: string,
  strokes: string,
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