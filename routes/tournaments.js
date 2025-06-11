const express = require('express');
const Tournament = require('../models/Tournament');
const { getConnectionStats } = require('../utils/sseHelpers');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { 
      status,
      limit = 50, 
      page = 1, 
      sortBy = 'startDate',
      sortOrder = 'asc',
      search 
    } = req.query;
    
    // Build the query object based on provided filters
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      // Search across multiple fields using MongoDB text search
      query.$or = [
        { name: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { course: new RegExp(search, 'i') }
      ];
    }
    
    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit))); // Cap at 100 items per page
    const skip = (pageNumber - 1) * limitNumber;
    
    // Determine sort order
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortObject = { [sortBy]: sortDirection };
    
    // Execute the query with pagination and sorting
    const tournaments = await Tournament.find(query)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNumber)
      .lean(); // Use lean() for better performance when you don't need Mongoose document methods
    
    // Get total count for pagination metadata
    const totalCount = await Tournament.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNumber);
    
    // Return the results with pagination metadata
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
      filters: {
        status,
        search
      }
    });
    
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tournaments',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id).lean();
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    res.json({ tournament });
    
  } catch (error) {
    console.error('Error fetching tournament:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch tournament',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalTournaments,
      upcomingTournaments,
      ongoingTournaments,
      completedTournaments
    ] = await Promise.all([
      Tournament.countDocuments({}),
      Tournament.countDocuments({ status: 'upcoming' }),
      Tournament.countDocuments({ status: 'ongoing' }),
      Tournament.countDocuments({ status: 'completed' })
    ]);
    
    // Get SSE connection statistics
    const sseStats = getConnectionStats();
    
    res.json({
      tournaments: {
        total: totalTournaments,
        upcoming: upcomingTournaments,
        ongoing: ongoingTournaments,
        completed: completedTournaments
      },
      realTimeConnections: sseStats
    });
    
  } catch (error) {
    console.error('Error fetching tournament stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tournament statistics',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;