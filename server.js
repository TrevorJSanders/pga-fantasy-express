const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const EventEmitter = require('events');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Enhanced WebSocket server configuration
const wss = new WebSocket.Server({ 
  server,
  // Add these options for better iOS Safari compatibility
  perMessageDeflate: false, // Disable compression which can cause issues on mobile
  clientTracking: true,
  maxPayload: 1024 * 1024 // 1MB limit
});

const pubsub = new EventEmitter();

// MONGODB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.once('open', () => {
  const changeStream = db.collection('tournaments').watch();
  changeStream.on('change', (change) => {
    console.log('📣 Change detected:', change);
    pubsub.emit('update', {
      type: 'update',
      data: change,
    });
  });
});

// Enhanced WebSocket handling
wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket connected from:', req.headers['user-agent']?.substring(0, 50));
  
  // Track connection state
  let isAlive = true;
  
  // Send initial welcome message
  const sendMessage = (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('❌ Error sending message:', error);
      }
    }
  };

  // Send welcome message
  sendMessage({ type: 'init', data: { message: 'Welcome!' } });

  // Handle incoming messages (including pings)
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 Received message:', message);
      
      if (message.type === 'ping') {
        sendMessage({ type: 'pong', timestamp: Date.now() });
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  // Handle pings for keep-alive
  ws.on('ping', () => {
    console.log('🏓 Received ping');
    ws.pong();
  });

  ws.on('pong', () => {
    console.log('🏓 Received pong');
    isAlive = true;
  });

  // Listen for updates
  const sendUpdate = (data) => sendMessage(data);
  pubsub.on('update', sendUpdate);

  // Handle close event
  ws.on('close', (code, reason) => {
    console.log(`❌ WebSocket disconnected - Code: ${code}, Reason: ${reason}`);
    pubsub.removeListener('update', sendUpdate);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('💥 WebSocket error:', error);
  });

  // Set up heartbeat to detect broken connections
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      console.log('💔 Connection appears dead, terminating');
      ws.terminate();
      return;
    }
    
    isAlive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Ping every 30 seconds

  // Clean up heartbeat on close
  ws.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Add WebSocket connection count endpoint for debugging
app.get('/api/ws-status', (req, res) => {
  res.json({
    connectedClients: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

// POLLING ENDPOINT
app.get('/api/leaderboard', async (req, res) => {
  try {
    const data = await db.collection('tournaments').find({}).toArray();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch leaderboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    wsClients: wss.clients.size 
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});