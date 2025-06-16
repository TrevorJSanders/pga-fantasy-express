const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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

// Add indexes for better query performance
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ slug: 1 });
tournamentSchema.index({ startDatetime: 1 });
tournamentSchema.index({ endDatetime: 1 });
tournamentSchema.index({ lastUpdated: -1 });

// Add a pre-save middleware to update lastUpdated
tournamentSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Tournament', tournamentSchema, 'tournaments');