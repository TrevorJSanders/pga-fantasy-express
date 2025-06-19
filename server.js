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
const wss = new WebSocket.Server({ server, path: '/ws', perMessageDeflate: false });
const pubsub = new EventEmitter();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {});

const db = mongoose.connection;
db.once('open', () => {
  const changeStream = db.collection('tournaments').watch();
  changeStream.on('change', (change) => {
    pubsub.emit('update', { type: 'update', data: change });
  });
});

// WebSocket handling for non-iOS clients only
wss.on('connection', (ws, req) => {
  const ua = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  if (isIOS) return ws.close(); // Close connection for iOS clients

  const sendMessage = (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  sendMessage({ type: 'init', data: { message: 'Welcome!' } });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'ping') {
        sendMessage({ type: 'pong', timestamp: Date.now() });
      }
    } catch (e) {}
  });

  const sendUpdate = (data) => sendMessage(data);
  pubsub.on('update', sendUpdate);

  ws.on('close', () => {
    pubsub.removeListener('update', sendUpdate);
  });
});

// Polling endpoint for iOS clients
app.get('/api/leaderboard', async (req, res) => {
  try {
    const since = req.query.since;
    const latestDoc = await db.collection('tournaments')
      .find()
      .sort({ lastUpdated: -1 })
      .limit(1)
      .toArray();

    const latestUpdate = latestDoc[0]?.lastUpdated;
    if (since && new Date(since) >= new Date(latestUpdate)) {
      return res.status(204).send(); // No update
    }

    const data = await db.collection('tournaments').find({}).toArray();
    res.json({ lastUpdated: latestUpdate, leaderboard: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    wsClients: wss.clients.size,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
