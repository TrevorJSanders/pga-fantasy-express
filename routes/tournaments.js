//tournaments.js
const express = require('express');
const Tournament = require('../models/Tournament');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      search
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    const now = new Date();
    const matchConditions = [];

    if (search) {
      matchConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { course: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const baseMatch = matchConditions.length ? { $and: matchConditions } : {};

    const results = await Tournament.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          inProgress: [
            {
              $match: {
                startDatetime: { $lte: now },
                endDatetime: { $gte: now }
              }
            },
            { $sort: { startDatetime: -1, _id: 1 } }
          ],
          scheduled: [
            {
              $match: {
                startDatetime: { $gt: now }
              }
            },
            { $sort: { startDatetime: 1, _id: 1 } }
          ],
          completed: [
            {
              $match: {
                endDatetime: { $lt: now }
              }
            },
            { $sort: { startDatetime: -1, _id: 1 } }
          ]
        }
      },
      {
        $project: {
          allTournaments: {
            $concatArrays: ['$inProgress', '$scheduled', '$completed']
          }
        }
      },
      { $unwind: '$allTournaments' },
      { $replaceRoot: { newRoot: '$allTournaments' } },
      { $skip: skip },
      { $limit: limitNumber }
    ]);

    // Count total matching docs (needed for pagination)
    const totalCount = await Tournament.countDocuments(baseMatch);
    const totalPages = Math.ceil(totalCount / limitNumber);

    res.json({
      tournaments: results,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        limit: limitNumber
      },
      filters: {
        search
      }
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({
      error: 'Failed to fetch tournaments',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error'
    });
  }
});


module.exports = router;