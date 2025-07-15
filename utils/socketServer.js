const { Server } = require('socket.io');
const { pubsub } = require('./changeStreams');
const Leaderboard = require('../models/Leaderboard');

let io;

const setupSocketIOServer = (httpServer) => {
  io = new Server(httpServer, {
    path: '/ws',
    transports: ['websocket'],
    cors: { origin: process.env.FRONTEND_URI },
    allowEIO3: true,
  });

  io.on('connection', (socket) => {
    socket.data.subscriptions = {};
    const socketHandlers = [];

    socket.on('subscribe', async (data) => {
      const subs = data.subscriptions || {};
      socket.data.subscriptions = subs;

      if (subs.entity === 'leaderboard' && subs.tournamentId) {
        try {
          const doc = await Leaderboard.findOne({ tournamentId: subs.tournamentId })
            .sort({ lastUpdated: -1 })
            .lean();
            socket.emit('initial_data', { ...doc, id: doc.id || '' });
        } catch (err) {
          console.error(`[socket:${socket.id}] Failed to send leaderboard initial_data:`, err.message);
        }
      }
    });

    const leaderboardHandler = (data) => {
      const subs = socket.data.subscriptions || {};
      if (subs.entity === 'leaderboard') {
        if (subs.tournamentId && subs.tournamentId !== data.tournamentId) return;
        socket.emit('leaderboard_update', data);
      }
    };

    pubsub.on('leaderboardChange', leaderboardHandler);
    socketHandlers.push(['leaderboardChange', leaderboardHandler]);

    socket.on('disconnect', () => {
      for (const [event, handler] of socketHandlers) {
        pubsub.off(event, handler);
      }
    });
  });
};

const closeSocketIOServer = () => {
  if (io) {
    io.close();
  }
};

module.exports = {
  setupSocketIOServer,
  closeSocketIOServer,
};
