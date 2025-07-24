const { Server } = require('socket.io');
const { pubsub } = require('./changeStreams');
const Leaderboard = require('../models/Leaderboard');

let io;

const setupSocketIOServer = (httpServer) => {
  io = new Server(httpServer, {
    path: "/ws",
    transports: ["polling", "websocket"], // Allow polling as a fallback
    cors: { origin: process.env.FRONTEND_URI },
    allowEIO3: true,
    pingInterval: 25000, // Increased from default 25000
    pingTimeout: 60000, // Increased from default 5000
  });

  io.on('connection', (socket) => {
    socket.data.subscriptions = {};
    const socketHandlers = [];

    socket.on('subscribe', async (data) => {
      const subs = data.subscriptions || {};
      socket.data.subscriptions = subs;

      if (subs.entity === 'leaderboard' && subs.tournamentId) {
        try {
          const doc = await Leaderboard.findOne({ _id: subs.tournamentId })
            .lean();

          if (doc) {
            socket.emit('initial_data', {
              ...doc,
              id: doc._id,
            });
          } else {
            console.warn(`[socket:${socket.id}] No leaderboard found for _id=${subs.tournamentId}`);
          }
        } catch (err) {
          console.error(`[socket:${socket.id}] Failed to send leaderboard initial_data:`, err.message);
        }
      }
    });

    const leaderboardHandler = (data) => {
      const subs = socket.data.subscriptions || {};
      if (subs.entity === 'leaderboard') {
        if (subs.tournamentId && subs.tournamentId !== data._id) return;

        socket.emit('leaderboard_update', {
          ...data,
          id: data._id,
        });
      }
    };

    pubsub.on('leaderboardChange', leaderboardHandler);
    socketHandlers.push(['leaderboardChange', leaderboardHandler]);

    socket.on("test-event", (data) => {
      socket.emit("test-response", { received: data, serverTime: new Date() });
    });

    const heartbeatInterval = setInterval(() => {
      socket.emit("heartbeat", { timestamp: new Date() });
    }, 5000);

    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
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
