const express = require('express');
const router = express.Router();
const Tournament = require('../models/tournamentSchema');

// GET /api/tournaments - Get all tournaments, sorted by startDatetime descending
router.get('/', async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ startDatetime: -1 });
    res.json(tournaments);
  } catch (err) {
    console.error('Error fetching tournaments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;