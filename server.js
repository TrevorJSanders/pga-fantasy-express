const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config();

const { configureCors } = require('./config/cors');
const { configureHeaders } = require('./config/headers');
const { initializeChangeStreams } = require('./utils/changeStreams');
const { setupSocketIOServer, closeSocketIOServer } = require('./utils/socketServer');

const tournamentRoutes = require('./routes/tournaments');
const leaderboardRoutes = require('./routes/leaderboards');
const pollingRoutes = require('./routes/polling');
const leaguesRoutes = require('./routes/leagues');
const userRoutes = require('./routes/users');
const inviteRoutes = require('./routes/invites');
const playersRoutes = require("./routes/players");
const teamRoutes = require("./routes/teams");

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
app.use('/api', pollingRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invites', inviteRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/teams", teamRoutes);

app.get('/health', (req, res) => {
  console.log('✅ Health check successful');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ERROR HANDLING
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

//SOCKET.IO
setupSocketIOServer(server);

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

  closeSocketIOServer();

  mongoose.connection.close(false).then(() => {
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  });
};


process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
server.keepAliveTimeout = 0;
server.headersTimeout = 0;

