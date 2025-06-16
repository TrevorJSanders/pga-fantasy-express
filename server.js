const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const { configureHeaders } = require('./config/headers');
const { configureCors } = require('./config/cors');
const { initializeChangeStreams } = require('./utils/changeStreams');

const tournamentRoutes = require('./routes/tournaments');
const leaderboardRoutes = require('./routes/leaderboards');
const sseRoutes = require('./routes/sse');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

//GLOBAL MIDDLEWARE
configureCors(app);
configureHeaders(app);
app.use(express.json());

//DB CONNECTION
mongoose.connect(MONGODB_URI)
.then(() => {
  console.log('Connected to MongoDB');
  initializeChangeStreams();
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

app.options('/api/sse/*');
app.use('/api/sse', sseRoutes);

//ALL OTHER ROUTES
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/leaderboards', leaderboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    activeSSEConnections: require('./utils/sseHelpers').getConnectionStats().activeConnections
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  
  // Close MongoDB connection
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Increase server timeout for SSE connections
server.timeout = 0; // Disable timeout for SSE
server.keepAliveTimeout = 65000; // Keep connections alive
server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

module.exports = app;