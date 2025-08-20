const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config();

const { configureCors } = require('./config/cors');
const { configureHeaders } = require('./config/headers');
const { initializeChangeStreams } = require('./utils/changeStreams');
const { redis } = require('./utils/redisPublisher');


const tournamentRoutes = require('./routes/tournaments');
const leaderboardRoutes = require('./routes/leaderboards');

const leaguesRoutes = require('./routes/leagues');
const userRoutes = require('./routes/users');
const inviteRoutes = require('./routes/invites');
const playersRoutes = require("./routes/players");
const teamRoutes = require("./routes/teams");
const logRoutes = require("./routes/logs");

const app = express();
app.set("trust proxy", 1); // Trust the first proxy
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// GLOBAL MIDDLEWARE
configureCors(app);
configureHeaders(app);
app.use(express.json());

// MONGO CONNECTION
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    initializeChangeStreams();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// ROUTES
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/leaderboards', leaderboardRoutes);

app.use('/api/leagues', leaguesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invites', inviteRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/logs", logRoutes);

app.get('/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const redisStatus = redis.status;

  const isHealthy = mongoStatus === 1 && redisStatus === 'ready';

  if (isHealthy) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: 'connected',
        redis: 'connected'
      }
    });
  } else {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Service Unavailable: One or more dependencies are not healthy.',
      dependencies: {
        mongodb: mongoStatus === 1 ? 'connected' : `disconnected (state: ${mongoStatus})`,
        redis: redisStatus === 'ready' ? 'connected' : `disconnected (state: ${redisStatus})`
      }
    });
  }
});

// ERROR HANDLING
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});



// START SERVER
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// SHUTDOWN SERVER
const gracefulShutdown = () => {
  console.log('\n🛑 Shutting down server...');

  server.close(() => {
    console.log('🧹 HTTP server closed');
  });

  

  mongoose.connection.close(false).then(() => {
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  });
};


process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
server.keepAliveTimeout = 0;
server.headersTimeout = 0;

