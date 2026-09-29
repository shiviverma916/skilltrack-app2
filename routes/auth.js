const express = require("express");
const db = require("../db");
const { verifyPassword } = require("../utils/crypto");
const { createSession, destroySession, requireAuth } = require("../middleware/auth");
const router = express.Router();

function publicUser(user) {
  const provider = user.provider_id ? db.getById("providers", user.provider_id) : null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    provider_id: user.provider_id,
    provider_name: provider ? provider.name : null
  };
}

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  const user = db.getAll("users").find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: "Incorrect username or password" });
  }
  const token = createSession(user);
  res.json({ token, user: publicUser(user) });
});

router.post("/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) destroySession(token);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.getById("users", req.user.id);
  if (!user) return res.status(401).json({ error: "Session user no longer exists" });
  res.json(publicUser(user));
});

module.exports = router;
