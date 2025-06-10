const express = require('express');
const mongoose = require('mongoose');
const tournamentRoutes = require('./routes/tournaments');
const leaderboardRoutes = require('./routes/leaderboards');

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;
const NODE_ENV = process.env.NODE_ENV;

console.log('Environment Variables:');
console.log(`NODE_ENV: ${NODE_ENV}`);
console.log(`PORT: ${PORT}`);

dotenv.config();
const app = express();
app.use(express.json());


async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB Atlas');
    
    // Set up change streams for real-time updates
    setupChangeStreams();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

connectToDatabase();

// Use routes
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/leaderboards', leaderboardRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));