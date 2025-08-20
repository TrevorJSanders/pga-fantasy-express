const express = require('express');
const router = express.Router();
const League = require("../models/League");
const Team = require("../models/Team");
const { requireAuth, syncUser } = require("../utils/requireAuth");

router.get("/all", async (req, res) => {
  try {
    const leagues = await League.find({});
    res.json(leagues);
  } catch (err) {
    console.error("Error fetching all leagues:", err);
    res.status(500).json({ error: "Server error fetching all leagues" });
  }
});

router.get("/admin", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: "User not authenticated" });

  try {
    const leagues = await League.find({ adminUserIds: userId });
    res.json(leagues);
  } catch (err) {
    console.error("Error fetching admin leagues:", err);
    res.status(500).json({ error: "Server error fetching leagues" });
  }
});

router.get("/me", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ error: "User not authenticated" });

  try {
    const leagues = await League.find({ memberUserIds: userId });
    res.json(leagues);
  } catch (err) {
    console.error("Error fetching user leagues:", err);
    res.status(500).json({ error: "Failed to fetch user leagues" });
  }
});

router.get("/:id", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  try {
    const league = await League.findById(req.params.id);

    if (!league) return res.status(404).json({ error: "League not found" });
    if (!league.adminUserIds.includes(userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(league);
  } catch (err) {
    console.error("Error fetching league:", err);
    res.status(500).json({ error: "Server error fetching league" });
  }
});

router.post("/", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;

  try {
    const newLeague = new League({
      ...req.body,
      createdBy: userId,
      adminUserIds: [userId],
      memberUserIds: [userId],
    });

    await newLeague.save();
    res.status(201).json(newLeague);
  } catch (err) {
    console.error("Failed to create league:", err);
    res.status(500).json({ error: "Failed to create league" });
  }
});

router.put("/:id", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;

  try {
    const league = await League.findById(req.params.id);
    if (!league || !league.adminUserIds.includes(userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    Object.assign(league, req.body);
    await league.save();
    res.json(league);
  } catch (err) {
    console.error("Error updating league:", err);
    res.status(500).json({ error: "Failed to update league" });
  }
});

router.delete("/:id", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;

  try {
    const league = await League.findById(req.params.id);
    if (!league || !league.adminUserIds.includes(userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await league.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error("Error deleting league:", err);
    res.status(500).json({ error: "Failed to delete league" });
  }
});

router.get("/:id/teams", requireAuth, syncUser, async (req, res) => {
  const { id } = req.params;

  try {
    const teams = await Team.find({leagueId: id})
      .populate("playerIds")
      .populate("userId", "name customName email picture customPicture")
      .lean();
    res.json({ teams });
  } catch (err) {
    console.error("Error fetching teams for league:", err);
    res.status(500).json({ error: "Failed to fetch league teams" });
  }
});

module.exports = router;
