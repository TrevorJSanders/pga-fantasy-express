const express = require("express");
const Team = require("../models/Team");
const League = require("../models/League");
const Tournament = require("../models/Tournament");
const router = express.Router();
const { requireAuth, syncUser } = require("../utils/requireAuth");
const { uploadTeam } = require("../utils/cloudinary");

const isRosterLocked = async (leagueId) => {
  const league = await League.findById(leagueId).populate('tournaments');
  if (!league) return false;

  const tournamentIds = league.tournaments.map(t => t._id);
  const liveTournaments = await Tournament.countDocuments({
    _id: { $in: tournamentIds },
    status: 'In Progress'
  });

  return liveTournaments > 0;
};

router.post("/", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.body;

  if (!leagueId) return res.status(400).json({ error: "Missing leagueId" });

  try {
    const existingTeam = await Team.findOne({ userId, leagueId });
    if (existingTeam) {
      return res.status(400).json({ error: "Team already exists in this league" });
    }

    const team = new Team({
      userId,
      leagueId,
      name: "My Team",
      playerIds: [],
      activePlayerIds: [],
    });

    await team.save();
    res.status(201).json(team);
  } catch (err) {
    console.error("Error creating team:", err);
    res.status(500).json({ error: "Failed to create team" });
  }
});

router.post("/:leagueId/upload-image", requireAuth, syncUser, uploadTeam.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image upload failed. No file provided.' });
  }
  res.status(201).json({ imageUrl: req.file.path });
});

router.get("/:leagueId/my-team", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;

  try {
    const team = await Team.findOne({ userId, leagueId })
      .populate("playerIds")
      .populate("userId");

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error getting team:", err);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

router.get("/:teamId", requireAuth, async (req, res) => {
  const { teamId } = req.params;

  try {
    const team = await Team.findById(teamId)
      .populate("playerIds")
      .populate("userId");

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error getting team by ID:", err);
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
    const team = await Team.findOne({ userId, leagueId });
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (team.activePlayerIds.includes(playerId)) {
      if (await isRosterLocked(leagueId)) {
        return res.status(400).json({ error: "Roster is locked during live tournaments." });
      }
    }

    const updatedTeam = await Team.findByIdAndUpdate(
      team._id,
      { $pull: { playerIds: playerId, activePlayerIds: playerId } },
      { new: true }
    ).populate("playerIds");

    res.json(updatedTeam);
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

router.patch("/:leagueId/image", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;
  const { imageUrl } = req.body;

  if (!imageUrl) return res.status(400).json({ error: "Missing image URL" });

  try {
    const team = await Team.findOneAndUpdate(
        { userId, leagueId },
        { imageUrl },
        { new: true }
    ).lean();

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error updating team image:", err);
    res.status(500).json({ error: "Failed to update team image" });
  }
});

router.patch("/:leagueId/active-players", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;
  const { activePlayerIds } = req.body;

  if (!activePlayerIds) return res.status(400).json({ error: "Missing activePlayerIds" });

  if (await isRosterLocked(leagueId)) {
    return res.status(400).json({ error: "Roster is locked during live tournaments." });
  }

  try {
    const team = await Team.findOneAndUpdate(
      { userId, leagueId },
      { activePlayerIds },
      { new: true }
    ).lean();

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error("Error updating active players:", err);
    res.status(500).json({ error: "Failed to update active players" });
  }
});

router.delete("/:leagueId", requireAuth, syncUser, async (req, res) => {
  const userId = req.auth.sub;
  const { leagueId } = req.params;

  try {
    if (await isRosterLocked(leagueId)) {
      return res.status(400).json({ error: "Roster is locked during live tournaments." });
    }
    const team = await Team.findOneAndDelete({ userId, leagueId });

    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json({ message: "Team deleted" });
  } catch (err) {
    console.error("Error deleting team:", err);
    res.status(500).json({ error: "Failed to delete team" });
  }
});

module.exports = router;
