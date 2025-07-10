const express = require('express');
const router = express.Router();
const User = require("../models/User");
const { upload } = require("../utils/cloudinary");
const { requireAuth, syncUser } = require("../utils/requireAuth");

router.get("/me", requireAuth, syncUser, async (req, res) => {
  res.json(req.user);
});

router.put("/me", requireAuth, syncUser, async (req, res) => {
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


router.get("/lookup", requireAuth, syncUser, async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Missing user ID in query" });
  }

  try {
    const user = await User.findOne({ auth0Id: id }).select(
      "auth0Id name email customName"
    );

    res.json(user);
  } catch (err) {
    console.error("Error looking up users:", err);
    res.status(500).json({ error: "Server error fetching users" });
  }
});

router.get("/me/invites", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  try {
    const leagues = await League.find({
      "invites.userId": userId,
      "invites.status": "pending",
    });

    const pendingInvites = leagues.map((league) => {
      const invite = league.invites.find(
        (i) => i.userId === userId && i.status === "pending"
      );
      return {
        leagueId: league._id,
        leagueName: league.name,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
      };
    });

    res.json(pendingInvites);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});


module.exports = router;
