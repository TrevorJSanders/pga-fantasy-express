const express = require('express');
const router = express.Router();
const User = require("../models/User");
const { upload } = require("../utils/cloudinary");
const { requireAuth, syncUser } = require("../utils/requireAuth");

router.get("/me", requireAuth, syncUser, async (req, res) => {
    console.log("GET /me");
    console.log(req.user);
  res.json(req.user);
});

router.put("/me", requireAuth, syncUser, async (req, res) => {
    console.log("PUT /me");
  try {
    const { customName, customPicture } = req.body;
    const user = await User.findOne({ auth0Id: req.auth.sub });

    if (!user) return res.status(404).json({ error: "User not found" });

    user.customName = customName ?? user.customName;
    user.customPicture = customPicture ?? user.customPicture;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error("Failed to update profile", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/me/upload", requireAuth, syncUser, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findOne({ auth0Id: req.auth.sub });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.customPicture = req.file.path;
    await user.save();

    res.json({ imageUrl: req.file.path });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
