const express = require('express');
const { getTournaments, getLeaderboards } = require('../utils/dataService'); // New helper location
const router = express.Router();

// Polling endpoint for tournaments (returns full set for now)
router.get('/tournaments', async (req, res) => {
  try {
    const data = await getTournaments();
    res.json({
      success: true,
      count: data.length,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tournaments for polling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tournaments'
    });
  }
});

// Polling endpoint for leaderboard (optionally filter by tournamentId)
router.get('/leaderboards', async (req, res) => {
  const { tournamentId, status, limit = 1 } = req.query;

  const filters = {};
  if (tournamentId) filters.tournamentId = tournamentId;
  if (status) filters.status = status;

  try {
    const data = await getLeaderboards(filters, parseInt(limit));
    res.json({
      success: true,
      count: data.length,
      filters,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching leaderboards for polling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboards'
    });
  }
});

module.exports = router;
