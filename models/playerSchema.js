const roundSchema = require('./roundSchema.js');

export const playerSchema = new mongoose.Schema({
  id: String,
  tournament: String,
  player: String,
  position: String,
  positionValue: Number,
  total: String,
  strokes: String,
  rounds: [roundSchema]
});