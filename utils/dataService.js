const Tournament = require('../models/Tournament');
const Leaderboard = require('../models/Leaderboard');

const getTournaments = async () => {
  return await Tournament.find({}).sort({ createdAt: -1 }).lean();
};

const getLeaderboards = async (filters = {}, limit = 1) => {
  return await Leaderboard.find(filters)
    .sort({ lastUpdated: -1 })
    .limit(limit)
    .lean();
};

module.exports = {
  getTournaments,
  getLeaderboards,
};
