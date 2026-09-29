const express = require("express");
const db = require("../db");
const { hashPassword } = require("../utils/crypto");
const { requireRole } = require("../middleware/auth");
const router = express.Router();

function publicUser(u) {
  const provider = u.provider_id ? db.getById("providers", u.provider_id) : null;
  return { id: u.id, username: u.username, name: u.name, role: u.role, provider_id: u.provider_id, provider_name: provider ? provider.name : null };
}

// All routes here are admin-only.
router.get("/", requireRole("admin"), (req, res) => {
  res.json(db.getAll("users").map(publicUser));
});

router.post("/", requireRole("admin"), (req, res) => {
  const { username, password, name, role, provider_id } = req.body || {};
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: "username, password, name and role are required" });
  }
  if (!["admin", "provider", "field_staff"].includes(role)) {
    return res.status(400).json({ error: "role must be admin, provider or field_staff" });
  }
  if (role !== "admin" && !provider_id) {
    return res.status(400).json({ error: "provider_id is required for provider and field_staff accounts" });
  }
  const exists = db.getAll("users").some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return res.status(400).json({ error: "That username is already taken" });

  const row = db.insert("users", {
    username,
    password: hashPassword(password),
    name,
    role,
    provider_id: role === "admin" ? null : Number(provider_id)
  });
  res.status(201).json(publicUser(row));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "You can't remove your own account while logged in as it" });
  }
  const ok = db.remove("users", req.params.id);
  if (!ok) return res.status(404).json({ error: "User not found" });
  res.status(204).end();
});

module.exports = router;
