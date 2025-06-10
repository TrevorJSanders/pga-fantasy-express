const express = require('express');
const router = express.Router();
const Leaderboard = require('../models/Leaderboard');

// GET all leaderboards
router.get('/', async (req, res) => {
  console.log("What's good cuz!");
  try {
    const leaderboards = await Leaderboard.find().sort({ startDatetime: -1 });
    res.json(leaderboards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET leaderboard by tournamentId
router.get('/:tournamentId', async (req, res) => {
  console.log("fruit!");
  try {
    const leaderboard = await Leaderboard.findOne({ tournamentId: req.params.tournamentId });
    if (!leaderboard) return res.status(404).json({ message: 'Not found' });
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;