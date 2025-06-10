// Railway SSE Middleware Server for Live Golf Tournament Updates
// This server maintains persistent SSE connections and broadcasts real-time tournament data

// Dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const tournamentRoutes = require('./routes/tournaments');
const leaderboardRoutes = require('./routes/leaderboards');
const Leaderboard = require('./models/Leaderboard');
const Tournament = require('./models/Tournament');

// Environment configuration
const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV;

console.log('Environment Variables:');
console.log(`NODE_ENV: ${NODE_ENV}`);
console.log(`PORT: ${PORT}`);

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

  // Validate and remove stale connections
  validateConnections() {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    this.connections.forEach((connection, connectionId) => {
        if (now - connection.lastPing > staleThreshold) {
            console.log(`Removing stale connection: ${connectionId}`);
            this.removeConnection(connectionId);
        }
    });
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
    console.log('Setting up MongoDB change streams...');
    
    try {
        // Watch for changes in the leaderboards collection
        const leaderboardChangeStream = Leaderboard.watch([
            { 
                $match: { 
                    operationType: { $in: ['update', 'replace', 'insert'] },
                    // Optional: Only watch for changes to specific fields
                    'updateDescription.updatedFields.leaderboard': { $exists: true }
                } 
            }
        ], { 
            fullDocument: 'updateLookup',
            // Add resume token support for reliability
            resumeAfter: null 
        });

        leaderboardChangeStream.on('change', (change) => {
            console.log(`Leaderboard change detected: ${change.operationType} for tournament ${change.fullDocument?.tournamentId}`);
            
            if (change.fullDocument) {
                const tournamentId = change.fullDocument.tournamentId;
                const updateData = {
                    tournamentId: tournamentId,
                    name: change.fullDocument.name,
                    status: change.fullDocument.status,
                    lastUpdated: change.fullDocument.lastUpdated,
                    playerCount: change.fullDocument.leaderboard ? change.fullDocument.leaderboard.length : 0,
                    changeType: change.operationType,
                    topPlayers: change.fullDocument.leaderboard ? change.fullDocument.leaderboard.slice(0, 10) : []
                };

                // Broadcast to all subscribers of this tournament
                const broadcastCount = sseManager.broadcastTournamentUpdate(tournamentId, updateData);
                console.log(`Broadcasted update to ${broadcastCount} connections`);
            }
        });

        leaderboardChangeStream.on('error', (error) => {
            console.error('Change stream error:', error);
            // Implement exponential backoff for reconnection
            setTimeout(() => {
                console.log('Attempting to restart change stream...');
                setupChangeStreams();
            }, 5000);
        });

        leaderboardChangeStream.on('close', () => {
            console.log('Change stream closed, attempting to reconnect...');
            setTimeout(setupChangeStreams, 2000);
        });

    } catch (error) {
        console.error('Failed to setup change streams:', error);
        setTimeout(setupChangeStreams, 10000);
    }
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
  res.setHeader('Access-Control-Allow-Origin', ['pga-fantasy.trevspage.com', 'localhost:5173']);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Cache-Control');
  
  // Required SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Optional: Handle preflight requests
  res.setHeader('Access-Control-Allow-Credentials', 'false');

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

  // Use routes
  app.use('/api/tournaments', tournamentRoutes);
  app.use('/api/leaderboards', leaderboardRoutes);
  
  app.listen(PORT, () => {
    console.log(`SSE Server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Worker PID: ${process.pid}`);
  });
}

console.log(`Starting server process: ${process.pid}`);
startServer();