const mongoose = require('mongoose');

const TournamentRosterSchema = new mongoose.Schema({
  leagueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: true,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  tournamentId: {
    type: String, // Changed from mongoose.Schema.Types.ObjectId to String
    ref: 'Tournament',
    required: true,
  },
  playerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
  }],
}, { timestamps: true });

module.exports = mongoose.model('TournamentRoster', TournamentRosterSchema);
