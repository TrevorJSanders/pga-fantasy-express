const express = require('express');
const router = express.Router();
const League = require("../models/League");
const Team = require("../models/Team");
const Leaderboard = require('../models/Leaderboard');
const { requireAuth, syncUser } = require("../utils/requireAuth");

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    if (!league.memberUserIds.includes(userId)) {
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
  const namespace = "https://pga-fantasy.trevspage.com";
  const name = req.auth[`${namespace}/name`];
  const email = req.auth[`${namespace}/email`];

  try {
    const { tournaments, ...restOfBody } = req.body;
    const newLeague = new League({
      ...restOfBody,
      tournaments,
      createdBy: userId,
      adminUserIds: [userId],
      memberUserIds: [userId],
    });

    await newLeague.save();

    await Team.create({
      userId,
      leagueId: newLeague._id,
      name: `${name || email}'s Team`,
      playerIds: [],
    });

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

router.get(
  '/:id/players/:playerName/scores', requireAuth, syncUser,
  async (req, res) => {
    try {
      const { id, playerName } = req.params;
      if (!id || !playerName) {
        return res.status(400).json({ message: 'Missing league ID or player name' });
      }

      const league = await League.findById(id).populate('tournaments');

      if (!league) {
        return res.status(404).json({ message: 'League not found' });
      }
      
      if (!Array.isArray(league.tournaments)) {
        console.error('League tournaments is not an array:', league.tournaments);
        return res.status(500).json({ message: 'Internal server error: malformed league data' });
      }

      const tournamentIds = league.tournaments.map((t) => t._id);
      const leaderboards = await Leaderboard.find({
        _id: { $in: tournamentIds },
      });

      const playerScores = league.tournaments.map((tournament) => {
        const leaderboard = leaderboards.find(
          (lb) => lb._id && lb._id.toString() === tournament._id.toString()
        );

        let tournamentName = tournament.name;
        let startDate = tournament.startDatetime;
        let endDate = tournament.endDatetime;
        let playerScore = null;

        if (leaderboard) {
          tournamentName = leaderboard.name || tournamentName;
          startDate = leaderboard.startDatetime || startDate;
          endDate = leaderboard.endDatetime || endDate;

          if (Array.isArray(leaderboard.leaderboard)) {
            const playerEntry = leaderboard.leaderboard.find(
              (p) => {
                if (p && p.player && typeof p.player === 'string') {
                  const safePlayerName = escapeRegExp(playerName);
                  const regex = new RegExp(safePlayerName, 'i');
                  return regex.test(p.player);
                }
                return false;
              }
            );
            if (playerEntry) {
              playerScore = playerEntry;
            }
          }
        }

        return {
          tournamentId: tournament._id,
          tournamentName,
          startDate,
          endDate,
          playerScore,
        };
      });

      res.json(playerScores);
    } catch (error) {
      console.error('Error fetching player scores:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
