const express = require("express");
const router = express.Router();
const { requireAuth, syncUser } = require("../utils/requireAuth");
const League = require("../models/League");
const Team = require("../models/Team");
const TournamentRoster = require("../models/TournamentRoster");
const { getLeaderboardByTournament } = require("../services/leaderboardService"); // Assuming this service exists

// Helper to calculate score for a single player in a single scoring group
const calculatePlayerScore = (playerScore, scoringGroup) => {
  let totalPoints = 0;
  if (scoringGroup.placementPoints) {
    for (const rule of scoringGroup.placementPoints) {
      if (rule.type === "exact" && playerScore.positionValue === rule.placement) {
        totalPoints += rule.points;
      } else if (rule.type === "range" && rule.topX && playerScore.positionValue <= rule.topX) {
        totalPoints += rule.points;
      }
    }
  }
  // strokePoints logic would go here if the data becomes available
  return totalPoints;
};

router.get("/:leagueId/teams", requireAuth, syncUser, async (req, res) => {
  const { leagueId } = req.params;

  try {
    const league = await League.findById(leagueId).lean();
    if (!league) {
      return res.status(404).json({ error: "League not found" });
    }

    const teams = await Team.find({ leagueId })
      .populate('userId', 'name customName picture customPicture email')
      .populate('playerIds') // Populate playerIds
      .lean();
    const teamScores = [];

    for (const team of teams) {
      let teamTotalScores = {};
      league.scoringGroups.forEach(group => {
        teamTotalScores[group.name] = 0;
      });

      const rosters = await TournamentRoster.find({ teamId: team._id }).populate('playerIds', 'name');

      for (const roster of rosters) {
        const leaderboard = await getLeaderboardByTournament(roster.tournamentId);

        if (leaderboard && leaderboard.leaderboard) {
          roster.playerIds.forEach(player => {
            const playerScore = leaderboard.leaderboard.find(p => p.player === player.name);
            if (playerScore) {
              league.scoringGroups.forEach(group => {
                teamTotalScores[group.name] += calculatePlayerScore(playerScore, group);
              });
            }
          });
        }
      }
      teamScores.push({
        ...team,
        scores: teamTotalScores,
      });
    }

    res.json(teamScores);

  } catch (err) {
    console.error("Error getting team scores:", err);
    res.status(500).json({ error: "Failed to fetch team scores" });
  }
});

module.exports = router;
