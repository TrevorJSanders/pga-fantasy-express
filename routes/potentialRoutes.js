// API endpoint to get specific tournament leaderboard with full details
app.get('/api/tournaments', async (req, res) => {
  try {
    console.log('Fetching tournaments list...');
    
    // Get tournaments with active leaderboards
    // This aggregation joins tournaments with their leaderboard data
    const tournaments = await tournament_leaderboards.aggregate([
      {
        // Match tournaments that have recent activity or are currently active
        $match: {
          $or: [
            { status: 'In Progress' },
            { 
              endDatetime: { 
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            }
          ]
        }
      },
      {
        // Sort by status priority and then by start date
        $sort: {
          status: 1, // In Progress first
          startDatetime: -1 // Then by most recent
        }
      }
    ]);

    console.log(`Found ${tournaments.length} active tournaments`);

    res.json({
      tournaments: tournaments,
      count: tournaments.length,
      timestamp: new Date().toISOString(),
      // Add metadata that might be useful for the frontend
      metadata: {
        activeCount: tournaments.filter(t => t.status === 'In Progress').length,
        scheduledCount: tournaments.filter(t => t.status === 'Scheduled').length,
        totalPlayers: tournaments.reduce((sum, t) => sum + t.playerCount, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tournaments',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/tournaments/:tournamentId/leaderboard', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    console.log(`Fetching leaderboard for tournament: ${tournamentId}`);

    // Find the tournament leaderboard with all details
    const leaderboard = await Leaderboard.findOne({ 
      tournamentId: tournamentId 
    }).lean(); // Use lean() for better performance as we're just reading data

    if (!leaderboard) {
      console.log(`Tournament ${tournamentId} not found`);
      return res.status(404).json({ 
        error: 'Tournament not found',
        tournamentId: tournamentId,
        timestamp: new Date().toISOString()
      });
    }

    // Transform the data to match exactly what your frontend expects
    const transformedTournament = {
      _id: leaderboard._id,
      tournamentId: leaderboard.tournamentId,
      lastUpdated: leaderboard.lastUpdated,
      id: leaderboard.tournamentId, // Your frontend expects both 'id' and 'tournamentId'
      sport: leaderboard.sport,
      tour: leaderboard.tour,
      startDatetime: leaderboard.startDatetime,
      endDatetime: leaderboard.endDatetime,
      name: leaderboard.name,
      slug: leaderboard.slug,
      logoUrl: leaderboard.logoUrl,
      link: leaderboard.link,
      course: leaderboard.course,
      location: leaderboard.location,
      status: leaderboard.status,
      leaderboard: leaderboard.leaderboard || []
    };

    console.log(`Returning leaderboard for ${leaderboard.name} with ${transformedTournament.leaderboard.length} players`);

    res.json({
      tournament: transformedTournament,
      timestamp: new Date().toISOString(),
      // Add some useful metadata
      metadata: {
        playerCount: transformedTournament.leaderboard.length,
        lastUpdated: leaderboard.lastUpdated,
        dataAge: Date.now() - new Date(leaderboard.lastUpdated).getTime()
      }
    });

  } catch (error) {
    console.error('Error fetching tournament leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tournament leaderboard',
      message: error.message,
      tournamentId: req.params.tournamentId,
      timestamp: new Date().toISOString()
    });
  }
});

// Bulk endpoint to get multiple tournament leaderboards efficiently
// This is useful for your frontend's initial loading when it needs several tournaments at once
app.post('/api/tournaments/bulk-leaderboards', async (req, res) => {
  try {
    const { tournamentIds } = req.body;
    
    if (!Array.isArray(tournamentIds) || tournamentIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: tournamentIds array is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Fetching bulk leaderboards for ${tournamentIds.length} tournaments`);

    // Fetch all requested tournaments in a single database query
    const leaderboards = await Leaderboard.find({
      tournamentId: { $in: tournamentIds }
    }).lean();

    // Transform the data to match frontend expectations
    const tournaments = leaderboards.map(leaderboard => ({
      _id: leaderboard._id,
      tournamentId: leaderboard.tournamentId,
      lastUpdated: leaderboard.lastUpdated,
      id: leaderboard.tournamentId,
      sport: leaderboard.sport,
      tour: leaderboard.tour,
      startDatetime: leaderboard.startDatetime,
      endDatetime: leaderboard.endDatetime,
      name: leaderboard.name,
      slug: leaderboard.slug,
      logoUrl: leaderboard.logoUrl,
      link: leaderboard.link,
      course: leaderboard.course,
      location: leaderboard.location,
      status: leaderboard.status,
      leaderboard: leaderboard.leaderboard || []
    }));

    // Create a map for easy lookup and identify missing tournaments
    const foundTournaments = new Map(tournaments.map(t => [t.tournamentId, t]));
    const missingTournaments = tournamentIds.filter(id => !foundTournaments.has(id));

    console.log(`Found ${tournaments.length}/${tournamentIds.length} tournaments`);
    if (missingTournaments.length > 0) {
      console.log(`Missing tournaments: ${missingTournaments.join(', ')}`);
    }

    res.json({
      tournaments: tournaments,
      requested: tournamentIds.length,
      found: tournaments.length,
      missing: missingTournaments,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching bulk leaderboards:', error);
    res.status(500).json({
      error: 'Failed to fetch bulk leaderboards',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search endpoint for finding tournaments by name or other criteria
app.get('/api/tournaments/search', async (req, res) => {
  try {
    const { 
      q: query, 
      status, 
      tour, 
      limit = 20,
      skip = 0 
    } = req.query;

    console.log(`Searching tournaments with query: "${query}"`);

    // Build search criteria
    const searchCriteria = {};
    
    if (query) {
      // Search in tournament name, location, or course
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } },
        { course: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (status) {
      searchCriteria.status = status;
    }
    
    if (tour) {
      searchCriteria.tour = tour;
    }

    const tournaments = await Leaderboard.find(searchCriteria)
      .select('tournamentId name status sport tour location course startDatetime endDatetime logoUrl lastUpdated')
      .sort({ startDatetime: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const totalCount = await Leaderboard.countDocuments(searchCriteria);

    res.json({
      tournaments: tournaments,
      pagination: {
        total: totalCount,
        returned: tournaments.length,
        skip: parseInt(skip),
        limit: parseInt(limit),
        hasMore: parseInt(skip) + tournaments.length < totalCount
      },
      query: {
        search: query,
        status: status,
        tour: tour
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error searching tournaments:', error);
    res.status(500).json({
      error: 'Failed to search tournaments',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Tournament status summary endpoint
app.get('/api/tournaments/summary', async (req, res) => {
  try {
    console.log('Generating tournament summary...');

    const summary = await Leaderboard.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPlayers: { 
            $sum: { 
              $cond: { 
                if: { $isArray: '$leaderboard' }, 
                then: { $size: '$leaderboard' }, 
                else: 0 
              } 
            } 
          },
          latestUpdate: { $max: '$lastUpdated' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalTournaments = summary.reduce((sum, item) => sum + item.count, 0);
    const totalPlayers = summary.reduce((sum, item) => sum + item.totalPlayers, 0);

    res.json({
      summary: {
        totalTournaments,
        totalPlayers,
        byStatus: summary
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating tournament summary:', error);
    res.status(500).json({
      error: 'Failed to generate tournament summary',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});