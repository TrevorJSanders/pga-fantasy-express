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
const wss = new WebSocket.Server({ server });
const pubsub = new EventEmitter();

// MONGODB CHANGE STREAM SETUP
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.once('open', () => {
  const changeStream = db.collection('tournaments').watch();

  changeStream.on('change', (change) => {
    console.log('📣 Change detected:', change);
    // emit to WebSocket subscribers
    pubsub.emit('update', change);
  });
});

// CLIENTS
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket connected');

  const sendUpdate = (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  // send initial data
  sendUpdate({ type: 'init', data: { message: 'Welcome!' } });

  // subscribe to changes
  pubsub.on('update', sendUpdate);

  ws.on('close', () => {
    console.log('❌ WebSocket disconnected');
    pubsub.removeListener('update', sendUpdate);
  });
});

// POLLING ENDPOINT
app.get('/api/leaderboard', async (req, res) => {
  const data = await db.collection('tournaments').find({}).toArray();
  res.json(data);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
