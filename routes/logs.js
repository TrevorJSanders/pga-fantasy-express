const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  const { level, message, context } = req.body;
  console.log(`[FRONTEND LOG] [${level.toUpperCase()}] ${message}`, context || '');
  res.status(200).send('Log received');
});

module.exports = router;
