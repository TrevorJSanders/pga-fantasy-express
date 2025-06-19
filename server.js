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
app.set('trust proxy', true); // <-- required for Railway's reverse proxy
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Sec-WebSocket-Extensions', 'x-webkit-deflate-frame');
  next();
});

const server = http.createServer(app);

server.on('connection', (socket) => {
  socket.setKeepAlive(true, 10000); // enable TCP keep-alive every 10 seconds
});

server.on('upgrade', (req, socket, head) => {
  console.log('⬆️  HTTP upgrade requested');
  socket.setKeepAlive(true, 10000);
});

server.on('request', (req, res) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=30, max=1000');
});

// Enhanced WebSocket server configuration
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  perMessageDeflate: false, // ✅ iOS fix: compression off
  clientTracking: true,
  maxPayload: 1024 * 1024 // 1MB
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
  const ua = req.headers['user-agent'] || '';
  console.log('🔌 WebSocket connected from:', ua.substring(0, 60));

  const ip = req.socket.remoteAddress;
  const isKeepAlive = req.socket.keepAlive;
  console.log('📡 IP:', ip, 'Keep-Alive:', isKeepAlive);

  let isAlive = true;

  const sendMessage = (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (err) {
        console.error('❌ Send error:', err);
      }
    }
  };

  // Initial handshake
  sendMessage({ type: 'init', data: { message: 'Welcome!' } });

  // Incoming message handler
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('📥 Message:', msg);

      if (msg.type === 'ping') {
        sendMessage({ type: 'pong', timestamp: Date.now() });
      }
    } catch (err) {
      console.error('❌ Invalid message:', err);
    }
  });

  // Listen to pubsub updates
  const sendUpdate = (data) => sendMessage(data);
  pubsub.on('update', sendUpdate);

  // Close and cleanup
  ws.on('close', (code, reason) => {
    console.log(`❌ WebSocket closed - Code: ${code}, Reason: ${reason.toString() || 'none'}`);
    pubsub.removeListener('update', sendUpdate);
    clearInterval(heartbeat);
  });

  // Error logging
  ws.on('error', (err) => {
    console.error('💥 WebSocket error:', err.message);
  });

  const heartbeat = setInterval(() => {
  if (!isAlive) {
    console.log('💀 Connection dead — terminating');
    ws.terminate();
    return;
  }

  isAlive = false;

  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.ping(); // trigger pong response
    } catch (err) {
      console.error('❌ Ping error:', err.message);
    }
  }
}, 7000); // every 7 seconds — more aggressive for mobile networks

  ws.on('pong', () => {
    isAlive = true;
    console.log('🏓 Pong received');
  });

  // Respond to manual pings
  ws.on('ping', () => {
    ws.pong();
    console.log('🏓 Ping received from client');
  });
});

// WebSocket status endpoint
app.get('/api/ws-status', (req, res) => {
  res.json({
    connectedClients: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

// Leaderboard polling fallback
app.get('/api/leaderboard', async (req, res) => {
  try {
    const data = await db.collection('tournaments').find({}).toArray();
    res.json(data);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Healthcheck
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
  console.log('🛑 SIGTERM received');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
