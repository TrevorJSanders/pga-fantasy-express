// utils/socketServer.js
const { Server } = require('socket.io');
const { pubsub } = require('./changeStreams');

let io;

const setupSocketIOServer = (httpServer) => {
  io = new Server(httpServer, {
    path: '/ws',
    cors: {
        origin: process.env.FRONTEND_URI,
        methods: ['GET', 'POST']
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['polling', 'websocket'],
    });

  io.on('connection', (socket) => {
    const ua = socket.handshake.headers['user-agent'] || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    console.log(`\uD83D\uDCF1 New ${isIOS ? 'iOS' : 'non-iOS'} Socket.IO connection`);

    socket.on('subscribe', async (data) => {
      const { entity, tournamentId } = data.subscriptions || {};
      socket.data.subscriptions = data.subscriptions;

      if (entity === 'tournament') {
        try {
          const Tournament = require('../models/Tournament');
          const docs = await Tournament.find({}, { _id: 0, __v: 0 }).lean();
          const cleaned = docs.map((t) => ({
            ...t,
            id: t.id || '',
          }));
          socket.emit('initial_data', cleaned);
        } catch (err) {
          console.error('❌ Failed to send initial_data:', err.message);
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔴 Socket.IO client disconnected: ${reason}`);
    });

    const sendUpdate = (eventType) => (data) => {
      const subs = socket.data.subscriptions || {};
      if (
        subs.tournamentId &&
        subs.tournamentId !== '*' &&
        subs.tournamentId !== data.tournamentId
      ) {
        return;
      }
      socket.emit(eventType, data);
    };

    const tournamentListener = sendUpdate('tournament_update');
    const leaderboardListener = sendUpdate('leaderboard_update');

    pubsub.on('tournamentChange', tournamentListener);
    pubsub.on('leaderboardChange', leaderboardListener);

    socket.on('disconnect', () => {
      pubsub.removeListener('tournamentChange', tournamentListener);
      pubsub.removeListener('leaderboardChange', leaderboardListener);
    });
  });
};

const closeSocketIOServer = () => {
  if (io) {
    io.close(() => console.log('🔒 Socket.IO server closed'));
  }
};

module.exports = {
  setupSocketIOServer,
  closeSocketIOServer
};
