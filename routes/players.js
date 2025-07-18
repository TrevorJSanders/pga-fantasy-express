const express = require("express");
const Player = require("../models/Player");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search = "", limit = 15, cursor } = req.query;
    const query = {};

     if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (cursor) {
      query._id = { ...(query._id || {}), $gt: cursor };
    }

    const players = await Player.find(query)
      .sort({ _id: 1 })
      .limit(parseInt(limit));

    const nextCursor = players.length > 0 ? players[players.length - 1]._id : null;

    res.json({
      players,
      nextCursor,
    });
  } catch (err) {
    console.error("Failed to fetch players:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

module.exports = router;
