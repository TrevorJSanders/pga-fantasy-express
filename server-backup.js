// Railway SSE Middleware Server for Live Golf Tournament Updates
// This server maintains persistent SSE connections and broadcasts real-time tournament data

// Dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const tournamentsRouter = require('./routes/tournaments.js');
const tournamentSchema = require('./models/Tournament.js');
const leaderboardSchema = require('./models/Leaderboard.js');

// Environment configuration
const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;
const NODE_ENV = process.env.NODE_ENV;

console.log('Environment Variables:');
console.log(`NODE_ENV: ${NODE_ENV}`);
console.log(`PORT: ${PORT}`);

// Create models
const Tournament = mongoose.model('Tournament', tournamentSchema, 'tournaments');
const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema, 'tournament_leaderboards');

// SSE Connection Manager
// This class handles all active SSE connections and broadcasting logic
class SSEConnectionManager {
  constructor() {
    this.connections = new Map(); // Store all active connections
    this.tournamentSubscriptions = new Map(); // Track which connections are subscribed to which tournaments
  }

  // Add a new SSE connection
  addConnection(connectionId, res, tournamentIds = []) {
    console.log(`Adding SSE connection: ${connectionId}`);
    
    const connection = {
      id: connectionId,
      response: res,
      connectedAt: new Date(),
      lastPing: new Date(),
      tournamentIds: new Set(tournamentIds)
    };

    this.connections.set(connectionId, connection);

    // Track tournament subscriptions for efficient broadcasting
    tournamentIds.forEach(tournamentId => {
      if (!this.tournamentSubscriptions.has(tournamentId)) {
        this.tournamentSubscriptions.set(tournamentId, new Set());
      }
      this.tournamentSubscriptions.get(tournamentId).add(connectionId);
    });

    // Set up connection cleanup when client disconnects
    res.on('close', () => {
      this.removeConnection(connectionId);
    });

    // Send initial connection confirmation
    this.sendToConnection(connectionId, {
      type: 'connection_established',
      connectionId: connectionId,
      timestamp: new Date().toISOString(),
      subscribedTournaments: tournamentIds
    });

    return connection;
  }

  // Remove a connection and clean up subscriptions
  removeConnection(connectionId) {
    console.log(`Removing SSE connection: ${connectionId}`);
    
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Clean up tournament subscriptions
      connection.tournamentIds.forEach(tournamentId => {
        const subscribers = this.tournamentSubscriptions.get(tournamentId);
        if (subscribers) {
          subscribers.delete(connectionId);
          if (subscribers.size === 0) {
            this.tournamentSubscriptions.delete(tournamentId);
          }
        }
      });

      this.connections.delete(connectionId);
    }
  }

  // Send data to a specific connection
  sendToConnection(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (connection && !connection.response.destroyed) {
      try {
        const sseData = `data: ${JSON.stringify(data)}\n\n`;
        connection.response.write(sseData);
        connection.lastPing = new Date();
        return true;
      } catch (error) {
        console.error(`Failed to send to connection ${connectionId}:`, error);
        this.removeConnection(connectionId);
        return false;
      }
    }
    return false;
  }

  // Broadcast tournament updates to all relevant subscribers
  broadcastTournamentUpdate(tournamentId, updateData) {
    const subscribers = this.tournamentSubscriptions.get(tournamentId);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for tournament ${tournamentId}`);
      return 0;
    }

    let successCount = 0;
    const message = {
      type: 'tournament_update',
      tournamentId: tournamentId,
      timestamp: new Date().toISOString(),
      data: updateData
    };

    subscribers.forEach(connectionId => {
      if (this.sendToConnection(connectionId, message)) {
        successCount++;
      }
    });

    console.log(`Broadcast tournament ${tournamentId} update to ${successCount}/${subscribers.size} connections`);
    return successCount;
  }

  // Send periodic heartbeat to maintain connections
  sendHeartbeat() {
    const heartbeatMessage = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      activeConnections: this.connections.size
    };

    let activeCount = 0;
    this.connections.forEach((connection, connectionId) => {
      if (this.sendToConnection(connectionId, heartbeatMessage)) {
        activeCount++;
      }
    });

    console.log(`Heartbeat sent to ${activeCount}/${this.connections.size} connections`);
    return activeCount;
  }

  // Get statistics about current connections
  getStats() {
    return {
      totalConnections: this.connections.size,
      tournamentSubscriptions: Array.from(this.tournamentSubscriptions.keys()).map(tournamentId => ({
        tournamentId,
        subscriberCount: this.tournamentSubscriptions.get(tournamentId).size
      }))
    };
  }
}

// Initialize the SSE connection manager
const sseManager = new SSEConnectionManager();

// Create Express app
const app = express();

// Security and CORS middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow SSE connections
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB Atlas');
    
    // Set up change streams for real-time updates
    setupChangeStreams();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Set up MongoDB Change Streams for real-time detection
function setupChangeStreams() {
  // Watch for changes in the leaderboards collection
  const leaderboardChangeStream = Leaderboard.watch([
    { $match: { operationType: { $in: ['update', 'replace', 'insert'] } } }
  ], { fullDocument: 'updateLookup' });

  leaderboardChangeStream.on('change', (change) => {
    console.log('Leaderboard change detected:', change.operationType);
    
    if (change.fullDocument) {
      const tournamentId = change.fullDocument.tournamentId;
      const updateData = {
        tournamentId: tournamentId,
        name: change.fullDocument.name,
        status: change.fullDocument.status,
        lastUpdated: change.fullDocument.lastUpdated,
        playerCount: change.fullDocument.leaderboard ? change.fullDocument.leaderboard.length : 0,
        changeType: change.operationType,
        // Include top 10 leaderboard for immediate display
        topPlayers: change.fullDocument.leaderboard ? change.fullDocument.leaderboard.slice(0, 10) : []
      };

      // Broadcast to all subscribers of this tournament
      sseManager.broadcastTournamentUpdate(tournamentId, updateData);
    }
  });

  leaderboardChangeStream.on('error', (error) => {
    console.error('Change stream error:', error);
    // Attempt to restart the change stream
    setTimeout(setupChangeStreams, 5000);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: sseManager.getStats(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// SSE endpoint for tournament updates
app.get('/stream/tournaments', async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Extract tournament IDs from query parameters
  const tornamentIdsParam = req.query.tournaments || req.query.tournamentIds || '';
  const tournamentIds = tornamentIdsParam ? tornamentIdsParam.split(',').filter(id => id.trim()) : [];
  
  // Generate unique connection ID
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add this connection to the manager
  sseManager.addConnection(connectionId, res, tournamentIds);

  // Send initial tournament data if specific tournaments were requested
  if (tournamentIds.length > 0) {
    try {
      const tournaments = await Leaderboard.find({ 
        tournamentId: { $in: tournamentIds } 
      }).select('tournamentId name status lastUpdated leaderboard');

      tournaments.forEach(tournament => {
        const initialData = {
          type: 'initial_data',
          tournamentId: tournament.tournamentId,
          name: tournament.name,
          status: tournament.status,
          lastUpdated: tournament.lastUpdated,
          playerCount: tournament.leaderboard ? tournament.leaderboard.length : 0,
          topPlayers: tournament.leaderboard ? tournament.leaderboard.slice(0, 10) : []
        };

        sseManager.sendToConnection(connectionId, initialData);
      });
    } catch (error) {
      console.error('Error fetching initial tournament data:', error);
      sseManager.sendToConnection(connectionId, {
        type: 'error',
        message: 'Failed to fetch initial tournament data'
      });
    }
  }
});

// Webhook endpoint for Atlas function notifications
app.post('/webhook/tournament-update', (req, res) => {
  // Verify webhook token for security
  const authHeader = req.headers.authorization;
  const providedToken = authHeader ? authHeader.replace('Bearer ', '') : '';
  
  if (providedToken !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tournaments, timestamp, source } = req.body;

  if (!tournaments || !Array.isArray(tournaments)) {
    return res.status(400).json({ error: 'Invalid tournaments data' });
  }

  console.log(`Received webhook notification for ${tournaments.length} tournaments from ${source}`);

  // Broadcast updates for each tournament
  tournaments.forEach(tournament => {
    const updateData = {
      tournamentId: tournament.tournamentId,
      name: tournament.name,
      changeType: tournament.changeType,
      playerCount: tournament.playerCount,
      webhookTimestamp: timestamp
    };

    sseManager.broadcastTournamentUpdate(tournament.tournamentId, updateData);
  });

  res.json({ 
    success: true, 
    processedTournaments: tournaments.length,
    timestamp: new Date().toISOString()
  });
});

// API endpoint to get current tournament data
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.find();

    res.json({
      tournaments: tournaments,
      count: tournaments.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// API endpoint to get specific tournament leaderboard
app.get('/api/tournaments/:tournamentId/leaderboard', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const leaderboard = await Leaderboard.findOne({ tournamentId: tournamentId });

    if (!leaderboard) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json({
      tournament: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tournament leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch tournament leaderboard' });
  }
});

// Connection statistics endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    ...sseManager.getStats(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    },
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Set up periodic heartbeat to maintain SSE connections
setInterval(() => {
  sseManager.sendHeartbeat();
}, 30000); // Send heartbeat every 30 seconds

// Start the server
async function startServer() {
  await connectToDatabase();
  
  app.listen(PORT, () => {
    console.log(`SSE Server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Worker PID: ${process.pid}`);
  });
}

console.log(`Starting server process: ${process.pid}`);
startServer();