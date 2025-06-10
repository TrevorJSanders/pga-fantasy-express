const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  course: String,
  endDatetime: Date,
  lastUpdated: { type: Date, default: Date.now },
  location: String,
  logoUrl: String,
  name: String,
  slug: String,
  startDatetime: Date,
  status: {
    type: String,
    enum: ['Completed', 'In Progress', 'Scheduled', 'Paused'],
    default: 'Scheduled'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for better query performance
tournamentSchema.index({ startDatetime: -1 });
tournamentSchema.index({ status: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);