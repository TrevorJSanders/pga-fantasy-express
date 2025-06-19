const express = require('express');
const http = require('http'); // ✅ use http, not https
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app); // ✅ just use http
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');

  ws.send('👋 Welcome to WebSocket!');

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`🫀 Heartbeat: ${Date.now()}`);
    }
  }, 3000);

  ws.on('close', () => {
    console.log('❌ Client disconnected');
    clearInterval(heartbeat);
  });
});

app.get('/', (req, res) => {
  res.send('✅ WebSocket server is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on Port:${PORT}`);
});
