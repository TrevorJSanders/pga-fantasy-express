const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    auth0Id: { type: String, required: true, unique: true, index: true},
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    customName: { type: String },
    picture: { type: String },
    customPicture: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ auth0Id: 1, email: 1 });

module.exports = mongoose.model("User", userSchema, "users");