// middleware/auth.js — simple token-based sessions (in-memory).
// Sessions reset when the server restarts; fine for this prototype.
// Roles: "admin" (sees/manages everything), "provider" (scoped to their own
// training-provider org), "field_staff" (scoped to their own provider, fewer
// permissions than "provider").

const crypto = require("crypto");

const sessions = new Map(); // token -> { userId, username, name, role, provider_id, expires }
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function createSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    provider_id: user.provider_id || null,
    expires: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? getSession(token) : null;
  if (!session) return res.status(401).json({ error: "Not authenticated. Please log in." });
  req.user = {
    id: session.userId,
    username: session.username,
    name: session.name,
    role: session.role,
    provider_id: session.provider_id
  };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    next();
  };
}

// Returns the provider_id a non-admin user is restricted to, or null for admins (no restriction).
function scopeProviderId(user) {
  return user.role === "admin" ? null : user.provider_id;
}

module.exports = { createSession, destroySession, getSession, requireAuth, requireRole, scopeProviderId };
