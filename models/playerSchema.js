const mongoose = require('mongoose');
const roundSchema = require('./roundSchema.js');

const playerSchema = new mongoose.Schema({
  id: String,
  tournament: String,
  player: String,
  position: String,
  positionValue: Number,
  total: String,
  strokes: String,
  rounds: [roundSchema]
});

module.exports = playerSchema;