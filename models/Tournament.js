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
  status: { type: String, enum: ['Completed', 'In Progress', 'Scheduled', 'Paused'] }
}, {
  timestamps: true,  // Automatically adds createdAt and updatedAt fields
  versionKey: '__v', // Add version key for optimistic concurrency control
  toJSON: {
    transform: function(doc, ret) {
      // Convert _id to id for frontend convenience
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('Tournament', tournamentSchema, 'tournaments');