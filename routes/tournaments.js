const express = require('express');
const Tournament = require('../models/Tournament');

const router = express.Router();

router.get('/all', async (req, res) => {
  try {
    const tournaments = await Tournament.find({}).sort({ startDatetime: 1 });
    res.json(tournaments);
  } catch (error) {
    console.error('Error fetching all tournaments:', error);
    res.status(500).json({
      error: 'Failed to fetch all tournaments',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      search,
      year,
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNumber - 1) * limitNumber;

    const matchConditions = {};

    if (search) {
      matchConditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { course: { $regex: search, $options: 'i' } }
      ];
    }

    if (year) {
      const yearNumber = parseInt(year, 10);
      if (!isNaN(yearNumber)) {
        const startDate = new Date(Date.UTC(yearNumber, 0, 1));
        const endDate = new Date(Date.UTC(yearNumber + 1, 0, 1));
        matchConditions.startDatetime = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    const totalCount = await Tournament.countDocuments(matchConditions);
    const totalPages = Math.ceil(totalCount / limitNumber);

    const tournaments = await Tournament.find(matchConditions)
      .sort({ startDatetime: 1 }) // ASCENDING SORT
      .skip(skip)
      .limit(limitNumber)
      .lean();

    res.json({
      tournaments,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        limit: limitNumber
      },
      filters: { search, year }
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error'
    });
  }
});

// Optional: Add route to fetch a tournament by its `id` field
router.get('/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({ tournament });
  } catch (err) {
    console.error('Error fetching tournament:', err);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

module.exports = router;
