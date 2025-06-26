const { Server } = require('socket.io');
const { pubsub } = require('./changeStreams');

let io;

const setupSocketIOServer = (httpServer) => {
  io = new Server(httpServer, {
    path: '/ws',
    transports: ['websocket'],
    cors: {
      origin: process.env.FRONTEND_URI,
      methods: ['GET', 'POST']
    },
    pingInterval: 5000,
    pingTimeout: 25000,
    allowEIO3: true,
    perMessageDeflate: false,
  });

  io.engine.on('initial_headers', (headers, req) => {
    console.log('[engine] 🧾 initial_headers from', req.socket.remoteAddress || req.headers['x-forwarded-for']);
    console.log('[engine] 🔎 Path:', req.url);
  });

  io.engine.on('connection_error', (err) => {
    console.error('[engine] ❌ Connection error:', err.code, err.message, err.context);
  });

  io.engine.on('upgrade', (req) => {
    console.log('[engine] 🔼 Upgrade attempt from', req.headers['user-agent']);
  });

  io.engine.on('packet', (packet) => {
    console.debug('[engine] 📦 Packet received:', packet.type, packet.nsp, packet.data);
  });

  io.use((socket, next) => {
    const { headers } = socket.handshake;
    console.log('[io] 🔐 Incoming socket connection attempt');
    console.log('   → Socket ID:', socket.id);
    console.log('   → User-Agent:', headers['user-agent']);
    console.log('   → Origin:', headers.origin);
    next();
  });

  io.on('connection', (socket) => {
    const startTime = Date.now();
    const ua = socket.handshake.headers['user-agent'] || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua);

    console.log(`📡 Client connected (${socket.id}) — ${isIOS ? 'iOS' : 'Other'}`);
    console.log('   → Transport:', socket.conn.transport.name);
    console.log(`   → Connected at: ${new Date(startTime).toISOString()}`);

    socket.emit('server_ready', {
      message: 'connected',
      pingInterval: 10000,
      serverTime: Date.now(),
    });

    socket.on('ping', (timestamp) => {
        console.log(`[socket:${socket.id}] 🔁 Received manual ping at ${new Date(timestamp).toISOString()}`);
    });

    socket.conn.on('upgrade', (transport) => {
      console.log(`🔄 Transport upgraded to ${transport.name}`);
    });

    socket.conn.on('packet', (packet) => {
        if (packet.type === 'ping') {
            console.log(`[socket:${socket.id}] 🔄 Ping received at ${new Date().toISOString()}`);
        }
        if (packet.type === 'pong') {
            console.log(`[socket:${socket.id}] 🏓 Pong received at ${new Date().toISOString()}`);
        }
    });

    socket.on('subscribe', async (data) => {
      console.log(`[socket:${socket.id}] 📥 Subscription received:`, data);
      socket.data.subscriptions = data.subscriptions;

      if (data.subscriptions?.entity === 'tournament') {
        try {
          await new Promise(res => setTimeout(res, 500));
          const Tournament = require('../models/Tournament');
          const docs = await Tournament.find({}, { _id: 0, __v: 0 }).lean();
          socket.emit('initial_data', docs.map((t) => ({ ...t, id: t.id || '' })));
        } catch (err) {
          console.error(`[socket:${socket.id}] ❌ Failed to send initial_data:`, err.message);
        }
      }
    });

    const sendUpdate = (eventType) => (data) => {
      const subs = socket.data.subscriptions || {};
      if (subs.tournamentId && subs.tournamentId !== '*' && subs.tournamentId !== data.tournamentId) return;
      console.log(`[socket:${socket.id}] 📤 Sending ${eventType} update`);
      socket.emit(eventType, data);
    };

    pubsub.on('tournamentChange', sendUpdate('tournament_update'));
    pubsub.on('leaderboardChange', sendUpdate('leaderboard_update'));

    socket.on('disconnect', (reason) => {
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.warn(`🔴 Disconnected (${socket.id}): ${reason} after ${durationSec}s`);
      console.log(`[socket:${socket.id}] 🔌 Disconnected: ${reason}`);

      //clearInterval(heartbeatInterval); // ✅ Clean up heartbeat
      pubsub.removeAllListeners('tournamentChange');
      pubsub.removeAllListeners('leaderboardChange');
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
