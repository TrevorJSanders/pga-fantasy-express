// ✅ Cleaned-up version of routes/polling.js
const express = require('express');
const router = express.Router();
const { getChangesSince } = require('../utils/changeCache');

router.get('/poll', (req, res) => {
  const { entity, since } = req.query;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  const sinceTs = parseInt(since || '0', 10);
  const changes = getChangesSince(entity, sinceTs);
  const payload = { changes, serverTime: Date.now() };

  return res.json(payload);
});

module.exports = router;
