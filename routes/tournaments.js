const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');

// GET all tournaments
router.get('/', async (req, res) => {
  console.log("In here baby!");
  try {
    const tournaments = await Tournament.find().sort({ startDatetime: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET a tournament by ID
router.get('/:id', async (req, res) => {
  console.log("Get em, Got em!");
  try {
    const tournament = await Tournament.findOne({ id: req.params.id });
    if (!tournament) return res.status(404).json({ message: 'Not found' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;