const express = require('express');
const { 
  getTournaments, 
  getLeaderboards,
  addSSEClient, 
  removeSSEClient,
  getConnectionStats,
  sendSSEMessage
} = require('../utils/sseHelpers');
const router = express.Router();

/**
 * Generate a unique client ID with more entropy
 */
const generateClientId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Common SSE setup function to reduce code duplication
 */
const setupSSEConnection = (res, clientId) => {

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
    'Transfer-Encoding': 'chunked', // Ensure chunked encoding
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  if (res.socket) {
    res.socket.setTimeout(0);
    res.socket.setNoDelay(true);
    res.socket.setKeepAlive(true);
  }
  
  sendSSEMessage(res, {
    type: 'connection',
    message: 'SSE connection established',
    clientId: clientId,
    timestamp: new Date().toISOString()
  });
  
  res.on('close', () => {
    console.log(`SSE client disconnected: ${clientId}`);
    removeSSEClient(clientId);
  });
  
  res.on('error', (error) => {
    console.error(`SSE connection error for ${clientId}:`, error);
    removeSSEClient(clientId);
  });
};

/**
 * Setup heartbeat and cleanup for SSE connections
 */
const setupSSEHeartbeat = (req, res, clientId) => {
  console.log('Heartbeat SSE initializing for client:', clientId);
  
  // Keep the connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeatInterval);
      return;
    }
   
    console.log('Sending heartbeat for client:', clientId);
    sendSSEMessage(res, {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    });
  }, 30000); // Send heartbeat every 30 seconds

  // Handle client disconnect
  const cleanup = () => {
    console.log(`SSE client disconnected: ${clientId}`);
    clearInterval(heartbeatInterval);
    removeSSEClient(clientId);
  };

  req.on('close', cleanup);
  req.on('error', (error) => {
    console.error(`SSE client error for ${clientId}:`, error);
    cleanup();
  });

  return heartbeatInterval;
};

// SSE endpoint for tournament updates
router.get('/tournaments', async (req, res) => {
  const clientId = generateClientId();
  console.log(`New tournament SSE client connected: ${clientId}`);
 
  setupSSEConnection(res, clientId);
  addSSEClient(clientId, res, 'tournament');
 
  try {
    const tournaments = await getTournaments();
    
    // Send the data with padding and flushing
    sendSSEMessage(res, {
      type: 'initial_data',
      dataType: 'tournaments',
      data: tournaments,
      count: Array.isArray(tournaments) ? tournaments.length : 1,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching initial tournament data:', error);
    sendSSEMessage(res, {
      type: 'error',
      message: 'Failed to fetch initial tournament data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 
  setupSSEHeartbeat(req, res, clientId);
});

// SSE endpoint for leaderboard updates
router.get('/leaderboards', async (req, res) => {
  const clientId = generateClientId();
  const { tournamentId, status, limit = 1 } = req.query;
  console.log(`New leaderboard SSE client connected: ${clientId}`, { tournamentId, status });
 
  setupSSEConnection(res, clientId);
  // 🔧 FIXED: Changed from 'leaderboards' to 'leaderboard' to match broadcasting logic
  addSSEClient(clientId, res, 'leaderboard', tournamentId);
 
  try {
    // Build query filters from request
    const filters = {};
    if (tournamentId) filters.tournamentId = tournamentId;
    if (status) filters.status = status;
    
    // Send initial leaderboard data immediately upon connection
    const leaderboards = await getLeaderboards(filters, parseInt(limit));
    sendSSEMessage(res, {
      type: 'initial_data',
      dataType: 'leaderboards',
      data: leaderboards,
      count: leaderboards.length,
      filters: filters,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching initial leaderboard data:', error);
    sendSSEMessage(res, {
      type: 'error',
      message: 'Failed to fetch initial leaderboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 
  setupSSEHeartbeat(req, res, clientId);
});

// Get connection statistics
router.get('/stats', (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;