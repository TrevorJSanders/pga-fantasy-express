// utils/changeCache.js
const recentChanges = {
  tournament: [],
  leaderboard: [],
};

const MAX_HISTORY_MS = 2 * 60 * 1000; // 2 minutes

const addChange = (entity, data) => {
  const now = Date.now();
  recentChanges[entity].push({ ts: now, data });
  recentChanges[entity] = recentChanges[entity].filter(
    (entry) => now - entry.ts <= MAX_HISTORY_MS
  );
};

const getChangesSince = (entity, sinceTimestamp) => {
  return recentChanges[entity].filter(entry => entry.ts > sinceTimestamp).map(entry => entry.data);
};

module.exports = {
  addChange,
  getChangesSince
};
