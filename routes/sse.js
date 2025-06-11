const express = require('express');
const { getTournaments, addSSEClient, removeSSEClient } = require('../utils/sseHelpers');

const router = express.Router();

// SSE endpoint for tournament updates
router.get('/tournaments', async (req, res) => {
  // Create a unique client ID for this connection
  const clientId = Date.now() + Math.random();
  
  console.log(`New SSE client connected: ${clientId}`);
  
  // Add this client to our active connections list
  addSSEClient(clientId, res);
  
  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ 
    type: 'connection', 
    message: 'Connected to tournament updates',
    clientId: clientId
  })}\n\n`);
  
  try {
    // Send initial tournament data immediately upon connection
    const tournaments = await getTournaments();
    res.write(`data: ${JSON.stringify({ 
      type: 'initial_data', 
      data: tournaments 
    })}\n\n`);
  } catch (error) {
    console.error('Error fetching initial tournament data:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: 'Failed to fetch initial data' 
    })}\n\n`);
  }
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`SSE client disconnected: ${clientId}`);
    removeSSEClient(clientId);
  });
  
  // Handle connection errors
  req.on('error', (error) => {
    console.error(`SSE client error for ${clientId}:`, error);
    removeSSEClient(clientId);
  });
  
  // Keep the connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeatInterval);
      return;
    }
    
    // Send a heartbeat to keep the connection alive
    res.write(`data: ${JSON.stringify({ 
      type: 'heartbeat', 
      timestamp: new Date().toISOString() 
    })}\n\n`);
  }, 30000); // Send heartbeat every 30 seconds
  
  // Clean up interval when client disconnects
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });
});

// Optional: Endpoint to manually trigger a broadcast (useful for testing)
router.post('/broadcast', (req, res) => {
  const { message, data } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required for broadcast' });
  }
  
  // This would use your broadcast helper function
  const broadcastData = {
    type: 'manual_broadcast',
    message,
    data: data || null,
    timestamp: new Date().toISOString()
  };
  
  // Import the broadcast function when needed
  const { broadcastToAllClients } = require('../utils/sseHelpers');
  broadcastToAllClients(broadcastData);
  
  res.json({ success: true, broadcasted: broadcastData });
});

module.exports = router;