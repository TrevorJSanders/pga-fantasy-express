const express = require("express");
const Invite = require("../models/Invite");
const League = require("../models/League");
const Team = require("../models/Team");
const router = express.Router();
const { requireAuth, syncUser } = require("../utils/requireAuth");

router.post("/:id/invite", requireAuth, syncUser, async (req, res) => {
  const { email } = req.body;
  const leagueId = req.params.id;
  const userId = req.auth.sub;

  try {
    const league = await League.findById(leagueId);
    if (!league || !league.adminUserIds.includes(userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const existing = await Invite.findOne({ leagueId, email });
    if (existing) {
      return res.status(400).json({ error: "Already invited" });
    }

    const invite = new Invite({
      leagueId,
      email,
      invitedBy: userId,
    });

    await invite.save();
    res.status(201).json(invite);
  } catch (err) {
    console.error("Error sending invite:", err);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

router.post("/mark-read", requireAuth, syncUser, async (req, res) => {
  const { inviteIds } = req.body;
  if (!inviteIds || !Array.isArray(inviteIds)) {
    return res.status(400).json({ message: 'inviteIds are required.' });
  }

  try {
    const email = req.user.email;
    await Invite.updateMany(
      { _id: { $in: inviteIds }, email: email },
      { $set: { read: true } }
    );
    res.status(200).json({ message: "Invites marked as read" });
  } catch (error) {
    res.status(500).json({ message: 'Error marking invites as read.' });
  }
});

router.get("/me", requireAuth, syncUser, async (req, res) => { // requireAuth and syncUser re-enabled
  const namespace = "https://pga-fantasy.trevspage.com";
  const email = req.auth[`${namespace}/email`];
  // console.log("Fetching invites for email:", email); // Removed console.log

  try {
    const invites = await Invite.find({ email, status: "pending" });
    // console.log("Invites found in DB for email:", email, ":", invites); // Removed log
    const leagueIds = invites.map(invite => invite.leagueId);
    const leagues = await League.find({ _id: { $in: leagueIds } }).select("name");
    // console.log("Leagues found for invite IDs:", leagueIds, ":", leagues); // Removed log

    const response = invites.map(invite => {
      const league = leagues.find(l => l._id.toString() === invite.leagueId.toString());
      return {
        _id: invite._id,
        leagueId: invite.leagueId,
        leagueName: league?.name || "Unknown League",
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
        read: invite.read,
      };
    });
    // console.log("Final response being sent:", response); // Removed log
    res.json(response);
  } catch (err) {
    console.error("Error fetching invites:", err);
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});

router.post("/:id/respond", requireAuth, syncUser, async (req, res) => {
  const namespace = "https://pga-fantasy.trevspage.com";
  const name = req.auth[`${namespace}/name`];
  const email = req.auth[`${namespace}/email`];
  const userId = req.auth.sub;
  const leagueId = req.params.id;
  const { accept } = req.body;

  try {
    const invite = await Invite.findOne({ leagueId, email, status: "pending" });
    if (!invite) {
      return res.status(404).json({ error: "No pending invite found" });
    }

    if (accept) {
      invite.status = "accepted";
      await invite.save();

      await League.findByIdAndUpdate(leagueId, {
        $addToSet: { memberUserIds: userId },
      });

      const existingTeam = await Team.findOne({ userId, leagueId });
      if (!existingTeam) {
        await Team.create({
          userId,
          leagueId,
          name: `${name || email}'s Team`,
          playerIds: [],
        });
      }

      return res.json({ message: "Joined league" });
    } else {
      invite.status = "declined";
      await invite.save();
      return res.json({ message: "Invite declined" });
    }
  } catch (err) {
    console.error("Error responding to invite:", err);
    res.status(500).json({ error: "Failed to respond to invite" });
  }
});

module.exports = router;