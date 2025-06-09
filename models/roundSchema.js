export const roundSchema = new mongoose.Schema({
  id: String,
  scorecard: String,
  round: Number,
  startingTee: Number,
  teeTime: Date,
  position: String,
  total: String,
  thru: String,
  scores: { type: String, default: null },
  score: Number
});