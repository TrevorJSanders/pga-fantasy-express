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
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const interval = setInterval(() => {
    if (ws.isAlive === false) {
      console.log('💀 Terminating inactive connection');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(); // 🔁 Ping client — if no pong, we'll terminate on next loop
  }, 15000); // 15s is a good default

  ws.send('👋 Welcome to WebSocket!');

  ws.on('close', () => {
    console.log('❌ Client disconnected');
    clearInterval(interval);
  });
});

app.get('/', (req, res) => {
  res.send('✅ WebSocket server is running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on Port:${PORT}`);
});
