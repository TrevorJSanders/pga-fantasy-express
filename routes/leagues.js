const express = require('express');
const router = express.Router();
const League = require("../models/League");
const { requireAuth, syncUser } = require("../utils/requireAuth");


router.get("/admin", requireAuth, syncUser, async (req, res) => {
  try {
    const userId = req.auth?.sub;
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    const leagues = await League.find({ adminUserIds: req.auth.sub });
    res.json(leagues);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching leagues" });
  }
});

router.get("/:id", requireAuth, syncUser, async (req, res) => {
  try {
    const league = await League.findById(req.params.id);

    if (!league) {
      return res.status(404).json({ error: "League not found" });
    }

    if (!league.adminUserIds.includes(req.auth.sub)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(league);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error fetching league" });
  }
});

router.post("/", requireAuth, syncUser, async (req, res) => {
  try {
    const userId = req.auth.sub;

    const newLeague = new League({
      ...req.body,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      adminUserIds: [userId],
    });

    await newLeague.save();
    res.status(201).json(newLeague);
  } catch (err) {
    console.error("Failed to create league:", err);
    res.status(500).json({ error: "Failed to create league" });
  }
});


router.put("/:id", requireAuth, syncUser, async (req, res) => {
  const league = await League.findById(req.params.id);
  if (!league || !league.adminUserIds.includes(req.auth.sub)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  Object.assign(league, req.body);
  await league.save();
  res.json(league);
});

router.delete("/:id", requireAuth, syncUser, async (req, res) => {
  const league = await League.findById(req.params.id);
  if (!league || !league.adminUserIds.includes(req.auth.sub)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await league.deleteOne();
  res.status(204).send();
});

module.exports = router;
