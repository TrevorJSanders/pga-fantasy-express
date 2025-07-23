module.exports = async function evaluateStartEligibility({
  league,
  team,
  player,
  tournament,
}) {
  const now = new Date()
  if (tournament.startDate < now && tournament.endDate > now) {
    return false;
  }

  const maxUses = league.startRule.maxStarts || Infinity;
  const currentUsage = team.playerUsage?.[player._id] || 0;
  if (currentUsage >= maxUses) {
    return false;
  }

  return true;
};
