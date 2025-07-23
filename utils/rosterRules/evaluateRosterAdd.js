const Team = require("../../models/Team");

async function evaluateRosterAdd({ league, team, player }) {
  const rosterType = league.rosterRule?.type || "open";

  // Use the correct field name
  const alreadyOnTeam = team.playerIds?.some(
    (id) => id.toString() === player._id.toString()
  );

  if (alreadyOnTeam) {
    return {
      allowed: false,
      reason: "Player is already on team",
    };
  }

  if (rosterType === "open") {
    return {
      allowed: true,
      reason: "Roster is open",
    };
  }

  if (rosterType === "draft") {
    const teams = await Team.find({ leagueId: league._id });

    const alreadyOwnedTeam = teams.find(
      (t) =>
        t.playerIds.some((id) => id.toString() === player._id.toString()) &&
        t._id.toString() !== team._id.toString()
    );

    if (alreadyOwnedTeam) {
      return {
        allowed: false,
        reason: `Player is already owned by ${alreadyOwnedTeam.name}`,
      };
    }

    return {
      allowed: true,
      reason: "Player is available in draft",
    };
  }

  if (rosterType === "locked") {
    return {
      allowed: false,
      reason: "Roster is locked",
    };
  }

  return {
    allowed: false,
    reason: "Could not determine roster type",
  };
}

module.exports = { evaluateRosterAdd };
