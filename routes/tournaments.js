//tournaments.js
const express = require('express');
const Tournament = require('../models/Tournament');

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
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { course: new RegExp(search, 'i') }
      ];
    }
    
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;
    
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortObject = { [sortBy]: sortDirection };
    
    const tournaments = await Tournament.find(query)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNumber)
      .lean();
    
    const totalCount = await Tournament.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNumber);
    
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

module.exports = router;