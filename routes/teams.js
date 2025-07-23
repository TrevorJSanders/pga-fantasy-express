const express = require("express");
const Team = require("../models/Team");
const router = express.Router();
const { requireAuth, syncUser } = require("../utils/requireAuth");

router.get("/:leagueId/my-team", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;

  try {
    const team = await Team.findOne({ userId, leagueId })
      .populate("playerIds")
      .lean();

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error getting team:", err);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

router.post("/:leagueId/add-player", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;
  const { playerId } = req.body;

  if (!playerId) return res.status(400).json({ error: "Missing playerId" });

  try {
    const team = await Team.findOneAndUpdate(
      { userId, leagueId },
      { $addToSet: { playerIds: playerId } },
      { new: true }
    ).populate("playerIds");

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error adding player to team:", err);
    res.status(500).json({ error: "Failed to add player to team" });
  }
});

router.post("/:leagueId/remove-player", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;
  const { playerId } = req.body;

  if (!playerId) return res.status(400).json({ error: "Missing playerId" });

  try {
    const team = await Team.findOneAndUpdate(
      { userId, leagueId },
      { $pull: { playerIds: playerId } },
      { new: true }
    ).populate("playerIds");

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error removing player from team:", err);
    res.status(500).json({ error: "Failed to remove player from team" });
  }
});

router.patch("/:leagueId/name", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Missing team name" });

  try {
    const team = await Team.findOneAndUpdate(
      { userId, leagueId },
      { name },
      { new: true }
    ).lean();

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error updating team name:", err);
    res.status(500).json({ error: "Failed to update team name" });
  }
});

router.delete("/:leagueId", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;

  try {
    const team = await Team.findOneAndDelete({ userId, leagueId });

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json({ message: "Team deleted" });
  } catch (err) {
    console.error("Error deleting team:", err);
    res.status(500).json({ error: "Failed to delete team" });
  }
});

module.exports = router;
