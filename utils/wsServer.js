// utils/wsServer.js
const WebSocket = require('ws');
const { pubsub } = require('./changeStreams');

const { safeStringify } = require('./safeStringify');

const activeClients = new Set();
let wss;

const setupWebSocketServer = (server) => {
  wss = new WebSocket.Server({
  noServer: true,
  path: '/ws',
  perMessageDeflate: false,
});

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  if (origin !== process.env.FRONTEND_URI) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

    wss.on('connection', (ws, req) => {
    const ua = req.headers['user-agent'] || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    console.log(`📡 New ${isIOS ? 'iOS' : 'non-iOS'} connection`);
    const heartbeatInterval = isIOS ? 10000 : 30000;
    console.log(`Heartbeat Interval: ${heartbeatInterval}`);

    activeClients.add(ws);
    console.log('🟢 WebSocket client connected');

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(safeStringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, heartbeatInterval);

    ws.on('message', (message) => {
      try {
          const str = typeof message === 'string' ? message : message.toString('utf8');
          console.log('📩 Received message:', str);
          const data = JSON.parse(str);

          if (data.type === 'ping') {
            ws.send(safeStringify({ type: 'pong', timestamp: Date.now() }));
          }

          if (data.type === 'subscribe') {
            ws.subscriptions = data.subscriptions || {};
            console.log('📡 Subscribed to:', ws.subscriptions);

            // Send initial data here
            if (ws.subscriptions.entity === 'tournament') {
                ws.send(safeStringify({ type: 'heartbeat', timestamp: Date.now() }));
                const Tournament = require('../models/Tournament');

                Tournament.find({}, { _id: 0, __v: 0 })
                    .lean()
                    .then((docs) => {
                        const cleaned = docs.map((t) => ({
                        ...t,
                        id: t.id || '',
                        }));
                        ws.send(safeStringify({ type: 'initial_data', data: cleaned }));
                    })
                    .catch((err) => {
                        console.error('❌ Failed to send initial_data:', err.message);
                    });
            }
          }
        } catch (err) {
            console.error('❌ Invalid WS message:', err.message);
        }
    });

    const sendUpdate = (eventType) => (data) => {
      const subscriptions = ws.subscriptions || {};

      // Filter by tournamentId if subscribed
      if (
        subscriptions.tournamentId &&
        subscriptions.tournamentId !== '*' &&
        subscriptions.tournamentId !== data.tournamentId
      ) {
        return;
        }

      try {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(safeStringify({ type: eventType, ...data }));
        }
      } catch (err) {
        console.error('❌ WS send failed:', err);
      }
    };

    const tournamentListener = sendUpdate('tournament_update');
    const leaderboardListener = sendUpdate('leaderboard_update');

    pubsub.on('tournamentChange', tournamentListener);
    pubsub.on('leaderboardChange', leaderboardListener);

    ws.on('close', () => {
      clearInterval(heartbeat);
      pubsub.removeListener('tournamentChange', tournamentListener);
      pubsub.removeListener('leaderboardChange', leaderboardListener);
      activeClients.delete(ws);
      console.log('🔴 WebSocket client disconnected');
    });
  });

  return wss;
};

const closeWebSocketServer = () => {
  if (wss) {
    wss.clients.forEach((client) => client.close());
    wss.close(() => console.log('🔒 WebSocket server closed'));
  }
};

module.exports = {
    closeWebSocketServer,
    setupWebSocketServer,
    activeClients,
};
