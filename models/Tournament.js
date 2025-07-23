const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  course: String,
  endDatetime: Date,
  lastUpdated: { type: Date, default: Date.now },
  location: String,
  logoUrl: String,
  name: { type: String, required: true },
  slug: String,
  startDatetime: Date,
  status: { 
    type: String, 
    enum: ['Completed', 'In Progress', 'Scheduled', 'Paused'],
    default: 'Scheduled'
  }
}, {
  timestamps: true,
  versionKey: false,
});

tournamentSchema.index({ status: 1 });
tournamentSchema.index({ slug: 1 });
tournamentSchema.index({ startDatetime: 1 });
tournamentSchema.index({ endDatetime: 1 });
tournamentSchema.index({ lastUpdated: -1 });

tournamentSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Tournament', tournamentSchema, 'tournaments');