import { expressjwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";
dotenv.config();

import User from "../models/User.js";

export const requireAuth = expressjwt({
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

export async function syncUser(req, res, next) {
  const namespace = "https://pga-fantasy.trevspage.com";
  const {
  sub,
  [`${namespace}/name`]: name,
  [`${namespace}/email`]: email,
  [`${namespace}/picture`]: picture,
} = req.auth;
  console.log("Auth: ", req.auth);

  try {
    const existing = await User.findOne({ auth0Id: sub });
    console.log("User exists: ", existing);

    if (!existing) {
      const user = await User.create({
        auth0Id: sub,
        name: name,
        email: email,
        picture: picture,
      });
      req.user = user;
      console.log("User created: ", user);
    } else {
      req.user = existing;
    }

    next();
  } catch (err) {
    console.error("Failed to sync user:", err);
    return res.status(500).json({ error: "User sync failed" });
  }
}

export default requireAuth;