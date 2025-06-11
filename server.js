const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { configureHeaders } = require('./config/headers');
const { configureCors } = require('./config/cors');
const { initializeChangeStreams } = require('./utils/changeStreams');
const tournamentRoutes = require('./routes/tournaments');
const sseRoutes = require('./routes/sse');

const app = express();
const PORT = process.env.PORT || 3001;

// Replace with your actual MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
const API_ENDPOINT_URI = process.env.API_ENDPOINT_URI;

// Database connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  // Initialize change streams after successful DB connection
  initializeChangeStreams();
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Middleware configuration
configureCors(app);
configureHeaders(app);
app.use(express.json());

// Routes
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/sse', sseRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`SSE endpoint available at: ${API_ENDPOINT_URI}:${PORT}/api/sse/tournaments`);
});