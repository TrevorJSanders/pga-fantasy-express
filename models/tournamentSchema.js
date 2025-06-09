const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  course: String,
  endDatetime: Date,
  lastUpdated: Date,
  location: String,
  logoUrl: String,
  name: String,
  slug: String,
  startDatetime: Date,
  status: {
    type: String,
    enum: ['Completed', 'In Progress', 'Scheduled', 'Paused']
  }
});

module.exports = mongoose.model('Tournament', tournamentSchema);