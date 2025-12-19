const Leaderboard = require('../models/Leaderboard');

const getLeaderboardByTournament = async (tournamentId) => {
  try {
    const result = await Leaderboard.findOne({ _id: tournamentId }).sort({ lastUpdated: -1 }).lean();
    return result;
  } catch (error) {
    console.error('Error fetching leaderboard by tournament:', error);
    return null;
  }
};

module.exports = {
  getLeaderboardByTournament,
};
