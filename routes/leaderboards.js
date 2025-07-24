const express = require('express');
const Leaderboard = require('../models/Leaderboard');
const router = express.Router();

// GET /leaderboards - paginated list
router.get('/', async (req, res) => {
  try {
    const {
      status,
      tournamentId,
      tour,
      sport,
      limit = 50,
      page = 1,
      sortBy = 'lastUpdated',
      sortOrder = 'desc',
      search
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (tournamentId) query.tournamentId = tournamentId;
    if (tour) query.tour = tour;
    if (sport) query.sport = sport;

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { course: new RegExp(search, 'i') },
        { tour: new RegExp(search, 'i') },
        { 'leaderboard.player': new RegExp(search, 'i') }
      ];
    }

    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortObject = { [sortBy]: sortDirection };

    const [leaderboards, totalCount] = await Promise.all([
      Leaderboard.find(query)
        .sort(sortObject)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Leaderboard.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limitNumber);

    res.json({
      leaderboards,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        limit: limitNumber
      },
      filters: {
        status,
        tournamentId,
        tour,
        sport,
        search
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboards',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /leaderboards/:id - single leaderboard (optionally hide leaderboard data)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const includeFullLeaderboard = req.query.includeFullLeaderboard !== 'false';

    const query = Leaderboard.findById(id);
    if (!includeFullLeaderboard) query.select({ leaderboard: 0 });

    const leaderboard = await query.lean();

    if (!leaderboard) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }

    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid leaderboard ID format' });
    }
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /leaderboards/tournament/:tournamentId - get latest or all for a tournament
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const latest = req.query.latest !== 'false';

    let query = Leaderboard.find({ tournamentId }).sort({ lastUpdated: -1 });
    if (latest) query = query.limit(1);

    const results = await query.lean();
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No leaderboard found for this tournament' });
    }

    const result = latest ? results[0] : results;
    res.json({ leaderboard: result, isLatest: latest });
  } catch (error) {
    console.error('Error fetching leaderboard by tournament:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? 10)));
    const page = Math.max(1, parseInt(req.query.page ?? 1));
    const skip = (page - 1) * limit;

    const leaderboards = await Leaderboard.find({ 'leaderboard.id': playerId })
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Leaderboard.countDocuments({ 'leaderboard.id': playerId });

    const playerHistory = leaderboards.map(lb => {
      const playerData = lb.leaderboard.find(p => p.id === playerId);
      return {
        tournamentId: lb.tournamentId,
        tournamentName: lb.name,
        position: playerData?.position,
        positionValue: playerData?.positionValue,
        total: playerData?.total,
        strokes: playerData?.strokes,
        lastUpdated: lb.lastUpdated,
        status: lb.status
      };
    });

    res.json({
      playerId,
      playerHistory,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching player leaderboard history:', error);
    res.status(500).json({
      error: 'Failed to fetch player history',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
