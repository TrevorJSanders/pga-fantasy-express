const Tournament = require('../models/Tournament');
const Leaderboard = require('../models/Leaderboard');

// Store active SSE connections in memory
const activeClients = new Map();

const addSSEClient = (clientId, response, type, tournamentId = null) => {
  activeClients.set(clientId, {
    response,
    type,
    tournamentId,
    connectedAt: new Date(),
    lastHeartbeat: new Date()
  });
  
  console.log(`Active SSE clients: ${activeClients.size}`);
};

const removeSSEClient = (clientId) => {
  const removed = activeClients.delete(clientId);
  if (removed) {
    console.log(`Removed SSE client ${clientId}. Active clients: ${activeClients.size}`);
  }
};

const sendSSEMessage = (res, data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  res.write(payload);
};

/**
 * Broadcast to clients watching specific tournaments
 */
const broadcastToTournamentClients = (data) => {
  const clientIds = Array.from(activeClients.keys());
  let successfulBroadcasts = 0;
  
  clientIds.forEach(clientId => {
    const client = activeClients.get(clientId);
    
    // Only broadcast to clients watching tournaments or this specific tournament
    if (client.type !== 'tournament') {
      return;
    }
    
    if (!client || client.response.writableEnded || client.response.destroyed) {
      activeClients.delete(clientId);
      return;
    }
    
    try {
      sendSSEMessage(client.response, data);
      client.lastHeartbeat = new Date();
      successfulBroadcasts++;
    } catch (error) {
      console.error(`Error broadcasting to tournament client ${clientId}:`, error);
      activeClients.delete(clientId);
    }
  });
  
  console.log(`Broadcasted tournament update to ${successfulBroadcasts} clients`);
};

/**
 * Broadcast to clients watching leaderboards
 */
const broadcastToLeaderboardClients = (tournamentId, data) => {
  const clientIds = Array.from(activeClients.keys());
  let successfulBroadcasts = 0;
  
  clientIds.forEach(clientId => {
    const client = activeClients.get(clientId);
    
    // Only broadcast to clients watching leaderboards or this specific leaderboard
    if (client.type !== 'leaderboard' || client.tournamentId !== tournamentId) {
      return;
    }
    
    if (!client || client.response.writableEnded || client.response.destroyed) {
      activeClients.delete(clientId);
      return;
    }
    
    try {
      sendSSEMessage(client.response, data);
      client.lastHeartbeat = new Date();
      successfulBroadcasts++;
    } catch (error) {
      console.error(`Error broadcasting to leaderboard client ${clientId}:`, error);
      activeClients.delete(clientId);
    }
  });
  
  console.log(`Broadcasted leaderboard update to ${successfulBroadcasts} clients for leaderboard ${tournamentId}`);
};

const getTournaments = async () => {
  try {
    const tournaments = await Tournament.find({}).sort({ createdAt: -1 }).lean();
    
    return tournaments;
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    throw error;
  }
};

const getLeaderboards = async (filters = {}, limit = 1) => {
  try {
    const leaderboards = await Leaderboard.find(filters)
      .sort({ lastUpdated: -1 })
      .limit(limit)
      .lean();
    return leaderboards;
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    throw error;
  }
};

/**
 * Handle tournament changes from the new change stream format
 * Now receives processed change data with only changed fields
 */
const handleTournamentChange = (changeData) => {
  console.log('Tournament change detected:', changeData.operationType);
  
  // Create broadcast data based on the new change stream format
  let broadcastData = {
    type: 'tournament_update',
    operation: changeData.operationType,
    tournamentId: changeData.tournamentId,
    timestamp: changeData.timestamp
  };
  
  // Handle different types of database operations
  switch (changeData.operationType) {
    case 'insert':
      broadcastData.data = changeData.changedFields; // Full document for inserts
      broadcastData.message = 'New tournament created';
      break;
      
    case 'update':
      // Only send the changed fields, not the full document
      broadcastData.changedFields = changeData.changedFields;
      broadcastData.removedFields = changeData.removedFields;
      broadcastData.metadata = changeData.metadata;
      broadcastData.message = 'Tournament updated';
      
      // Log what specifically changed for debugging
      const changedFieldNames = Object.keys(changeData.changedFields || {});
      console.log(`Tournament ${changeData.documentId} updated fields:`, changedFieldNames);
      
      // Skip broadcasting if no significant changes
      if (!isSignificantChange(changeData.changedFields)) {
        console.log('Skipping broadcast for insignificant tournament change');
        return;
      }
      break;
      
    case 'delete':
      broadcastData.deletedId = changeData.documentId;
      broadcastData.message = 'Tournament deleted';
      break;
      
    case 'replace':
      broadcastData.data = changeData.changedFields; // Full document for replace
      broadcastData.message = 'Tournament replaced';
      break;
      
    default:
      console.log('Unhandled tournament change type:', changeData.operationType);
      return;
  }
  
  broadcastToTournamentClients(broadcastData);
};

/**
 * Handle leaderboard changes from the new change stream format
 */
const handleLeaderboardChange = (changeData) => {
  console.log('Leaderboard change detected:', changeData.operationType);
  
  // Create broadcast data
  let broadcastData = {
    type: 'leaderboard_update',
    operation: changeData.operationType,
    tournamentId: changeData.tournamentId,
    timestamp: changeData.timestamp
  };
  
  // Handle different types of database operations
  switch (changeData.operationType) {
    case 'insert':
      broadcastData.data = changeData.changedFields; // Full document for inserts
      broadcastData.message = 'New leaderboard created';
      break;
      
    case 'update':
      // Only send the changed fields, not the full document
      broadcastData.changedFields = changeData.changedFields;
      broadcastData.removedFields = changeData.removedFields;
      broadcastData.metadata = changeData.metadata;
      broadcastData.message = 'Leaderboard updated';
      
      // Log what specifically changed for debugging
      const changedFieldNames = Object.keys(changeData.changedFields || {});
      console.log(`Leaderboard ${changeData.documentId} updated fields:`, changedFieldNames);
      console.log(`Tournament ID: ${broadcastData.tournamentId}`);
      
      // Skip broadcasting if no significant changes
      if (!isSignificantChange(changeData.changedFields)) {
        console.log('Skipping broadcast for insignificant leaderboard change');
        return;
      }
      break;
      
    case 'delete':
      broadcastData.deletedId = changeData.documentId;
      broadcastData.message = 'Leaderboard deleted';
      break;
      
    case 'replace':
      broadcastData.data = changeData.changedFields; // Full document for replace
      broadcastData.message = 'Leaderboard replaced';
      break;
      
    default:
      console.log('Unhandled leaderboard change type:', changeData.operationType);
      return;
  }
  
  broadcastToLeaderboardClients(broadcastData.tournamentId, broadcastData);
};

/**
 * Helper function to determine if a change is significant enough to broadcast
 * Filters out insignificant field changes to reduce noise
 */
const isSignificantChange = (changedFields) => {
  if (!changedFields || Object.keys(changedFields).length === 0) {
    return false;
  }
  
  // Define fields that we don't consider significant for broadcasting
  // Add or remove fields based on your application's needs
  const insignificantFields = [
    'lastAccessed',
    'viewCount', 
    '__v',
    'lastViewed',
    'accessCount',
    'metadata.lastPing',
    'stats.views'
  ];
  
  const significantFields = Object.keys(changedFields).filter(
    field => !insignificantFields.some(insignificant => 
      field === insignificant || field.startsWith(insignificant + '.')
    )
  );
  
  return significantFields.length > 0;
};

const getConnectionStats = () => {
  return {
    activeConnections: activeClients.size,
    connections: Array.from(activeClients.entries()).map(([id, client]) => ({
      clientId: id,
      type: client.type,
      connectedAt: client.connectedAt,
      lastHeartbeat: client.lastHeartbeat,
      connectionDuration: Date.now() - client.connectedAt.getTime(),
      isConnected: !client.response.writableEnded && !client.response.destroyed
    }))
  };
};

module.exports = {
  addSSEClient,
  removeSSEClient,
  broadcastToTournamentClients,
  broadcastToLeaderboardClients,
  getTournaments,
  getLeaderboards,
  handleTournamentChange,
  handleLeaderboardChange,
  getConnectionStats,
  sendSSEMessage,
  isSignificantChange
};