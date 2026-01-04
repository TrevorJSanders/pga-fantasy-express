const { expressjwt } = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const dotenv = require("dotenv");
dotenv.config();

const User = require("../models/User.js");

const requireAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

async function syncUser(req, res, next) {
  const namespace = "https://pga-fantasy.trevspage.com";
  const {
  sub,
  [`${namespace}/name`]: name,
  [`${namespace}/email`]: email,
  [`${namespace}/picture`]: picture,
} = req.auth;

  try {
    const existing = await User.findById(sub);

    if (!existing) {
      const user = await User.create({
        _id: sub,
        name: name,
        email: email,
        picture: picture,
      });
      req.user = user;
    } else {
      req.user = existing;
    }

    next();
  } catch (err) {
    console.error("Failed to sync user:", err);
    return res.status(500).json({ error: "User sync failed" });
  }
}

module.exports = { requireAuth, syncUser };