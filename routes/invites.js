const express = require("express");
const Invite = require("../models/Invite");
const League = require("../models/League");
const router = express.Router();
const { requireAuth, syncUser } = require("../utils/requireAuth");

router.post("/:id/invite", requireAuth, syncUser, async (req, res) => {
  const { email } = req.body;
  const leagueId = req.params.id;

  console.log(email, leagueId);

  const league = await League.findById(leagueId);
  if (!league || !league.adminUserIds.includes(req.auth.sub)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const existing = await Invite.findOne({ leagueId, email });
  if (existing) {
  console.log(email, leagueId);
    return res.status(400).json({ error: "Already invited" });
  }

  const invite = new Invite({
    leagueId,
    email,
    invitedBy: req.auth.sub,
  });

  await invite.save();
  res.status(201).json(invite);
});

router.get("/me", requireAuth, async (req, res) => {
  const namespace = "https://pga-fantasy.trevspage.com";
  const email = req.auth[`${namespace}/email`];
  try {
    const invites = await Invite.find({ email: email, status: "pending" });
    const leagueIds = invites.map(invite => invite.leagueId);
    const leagues = await League.find({ _id: { $in: leagueIds } }).select("name");

    const response = invites.map(invite => {
      const league = leagues.find(l => l._id.toString() === invite.leagueId);
      return {
        leagueId: invite.leagueId,
        leagueName: league?.name || "Unknown League",
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
      };
    });

    res.json(response);
  } catch (err) {
    console.error("Error fetching invites:", err);
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});

router.post("/:id/respond", requireAuth, syncUser, async (req, res) => {
  const namespace = "https://pga-fantasy.trevspage.com";
  const email = req.auth[`${namespace}/email`];
  const userId = req.auth.sub;
  const leagueId = req.params.id;
  const { accept } = req.body;

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

    return res.json({ message: "Joined league" });
  } else {
    invite.status = "declined";
    await invite.save();

    return res.json({ message: "Invite declined" });
  }
});


module.exports = router;
