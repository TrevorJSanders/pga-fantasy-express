const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    auth0Id: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, index: true },
    picture: { type: String },
    customName: { type: String },
    customPicture: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema, "users");