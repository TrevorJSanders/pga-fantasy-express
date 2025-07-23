const express = require("express");
const Player = require("../models/Player");
const Team = require("../models/Team");
const League = require("../models/League");
const { evaluateRosterAdd } = require("../utils/rosterRules/evaluateRosterAdd");
const { requireAuth, syncUser } = require("../utils/requireAuth");
const router = express.Router();

router.get("/", requireAuth, syncUser, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const { search = "", limit = 15, cursor, leagueId } = req.query;

    const parsedLimit = Math.min(parseInt(limit) || 15, 100);
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (cursor) {
      query._id = { $gt: cursor };
    }

    const players = await Player.find(query)
      .sort({ _id: 1 })
      .limit(parsedLimit)
      .lean();

    let evaluatedPlayers;

    if (leagueId) {
      const [team, league] = await Promise.all([
        Team.findOne({"userId": userId, "leagueId": leagueId}).lean(),
        League.findById(leagueId),
      ]);
      
      if(!team || !league) {
        return res.status(404).json({ error: "Team or league not found" });
      }

      evaluatedPlayers = await Promise.all(
        players.map(async (player) => {
          const evaluation = await evaluateRosterAdd({ league, team, player });
          return {
            ...player,
            allowed: evaluation.allowed,
            reason: evaluation.reason,
          };
        })
      );
    } else {
      evaluatedPlayers = players.map((player) => ({
        ...player,
        allowed: true,
        reason: "No league/team context",
      }));
    }

    const nextCursor = players.length > 0 ? players[players.length - 1]._id : null;

    console.log("evaluatedPlayers", evaluatedPlayers);

    res.json({
      players: evaluatedPlayers,
      nextCursor,
    });

  } catch (err) {
    console.error("Failed to fetch players:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

module.exports = router;
