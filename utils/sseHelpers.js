const Tournament = require('../models/Tournament'); // You'll need to create this model

// Store active SSE connections in memory
// In production, you might want to use Redis for scaling across multiple server instances
const activeClients = new Map();

/**
 * Add a new SSE client to our active connections
 * This function maintains a list of all connected clients so we can broadcast to them
 */
const addSSEClient = (clientId, response) => {
  activeClients.set(clientId, {
    response,
    connectedAt: new Date(),
    lastHeartbeat: new Date()
  });
  
  console.log(`Active SSE clients: ${activeClients.size}`);
};

/**
 * Remove an SSE client from our active connections
 * This happens when a client disconnects or encounters an error
 */
const removeSSEClient = (clientId) => {
  const removed = activeClients.delete(clientId);
  if (removed) {
    console.log(`Removed SSE client ${clientId}. Active clients: ${activeClients.size}`);
  }
};

/**
 * Broadcast data to all connected SSE clients
 * This is the core function that sends updates to your React frontend
 */
const broadcastToAllClients = (data) => {
  console.log(`Broadcasting to ${activeClients.size} clients:`, data.type);
  
  // Create a copy of client IDs to avoid issues if the Map changes during iteration
  const clientIds = Array.from(activeClients.keys());
  
  clientIds.forEach(clientId => {
    const client = activeClients.get(clientId);
    
    if (!client || client.response.writableEnded) {
      // Client connection is closed, remove it
      activeClients.delete(clientId);
      return;
    }
    
    try {
      // Format the data as an SSE message
      // The double newline (\n\n) is required by the SSE specification
      client.response.write(`data: ${JSON.stringify(data)}\n\n`);
      client.lastHeartbeat = new Date();
    } catch (error) {
      console.error(`Error broadcasting to client ${clientId}:`, error);
      // Remove problematic client
      activeClients.delete(clientId);
    }
  });
};

/**
 * Fetch tournament data from the database
 * This provides the initial data when clients first connect
 */
const getTournaments = async () => {
  try {
    // Fetch all tournaments, sorted by creation date (newest first)
    // You might want to add pagination or filtering here based on your needs
    const tournaments = await Tournament.find({}).sort({ createdAt: -1 }).lean();
    return tournaments;
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    throw error;
  }
};

/**
 * Handle tournament changes from MongoDB Change Streams
 * This function processes database changes and broadcasts them to connected clients
 */
const handleTournamentChange = (changeEvent) => {
  console.log('Tournament change detected:', changeEvent.operationType);
  
  // Extract relevant information from the change event
  let broadcastData = {
    type: 'tournament_update',
    operation: changeEvent.operationType,
    timestamp: new Date().toISOString()
  };
  
  // Handle different types of database operations
  switch (changeEvent.operationType) {
    case 'insert':
      broadcastData.data = changeEvent.fullDocument;
      broadcastData.message = 'New tournament created';
      break;
      
    case 'update':
      broadcastData.data = changeEvent.fullDocument;
      broadcastData.documentId = changeEvent.documentKey._id;
      broadcastData.updatedFields = changeEvent.updateDescription?.updatedFields;
      broadcastData.message = 'Tournament updated';
      break;
      
    case 'delete':
      broadcastData.documentId = changeEvent.documentKey._id;
      broadcastData.message = 'Tournament deleted';
      break;
      
    case 'replace':
      broadcastData.data = changeEvent.fullDocument;
      broadcastData.documentId = changeEvent.documentKey._id;
      broadcastData.message = 'Tournament replaced';
      break;
      
    default:
      console.log('Unhandled change type:', changeEvent.operationType);
      return; // Don't broadcast unknown change types
  }
  
  // Broadcast the change to all connected clients
  broadcastToAllClients(broadcastData);
};

/**
 * Get statistics about active SSE connections
 * Useful for monitoring and debugging
 */
const getConnectionStats = () => {
  return {
    activeConnections: activeClients.size,
    connections: Array.from(activeClients.entries()).map(([id, client]) => ({
      clientId: id,
      connectedAt: client.connectedAt,
      lastHeartbeat: client.lastHeartbeat,
      connectionDuration: Date.now() - client.connectedAt.getTime()
    }))
  };
};

module.exports = {
  addSSEClient,
  removeSSEClient,
  broadcastToAllClients,
  getTournaments,
  handleTournamentChange,
  getConnectionStats
};