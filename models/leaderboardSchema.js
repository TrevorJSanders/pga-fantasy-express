const mongoose = require('mongoose');
const playerSchema = require('./playerSchema.js');

const leaderboardSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true, unique: true },
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
  status: {
    type: String,
    enum: ['Completed', 'In Progress', 'Scheduled', 'Paused']
  },
  leaderboard: [playerSchema]
});

module.exports = leaderboardSchema;