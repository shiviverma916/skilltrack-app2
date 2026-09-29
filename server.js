const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const { requireAuth, requireRole } = require("./middleware/auth");

const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const traineesRouter = require("./routes/trainees");
const catalogRouter = require("./routes/catalog");
const placementsRouter = require("./routes/placements");
const followupsRouter = require("./routes/followups");
const analyticsRouter = require("./routes/analytics");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Public: login/logout/me
app.use("/api/auth", authRouter);

// Everything else under /api requires a valid session
app.use("/api", requireAuth);

app.use("/api/users", usersRouter); // admin-only, enforced inside the router
app.use("/api/trainees", traineesRouter);
app.use("/api", catalogRouter); // /api/providers, /api/courses
app.use("/api/placements", placementsRouter);
app.use("/api/followups", followupsRouter);
app.use("/api/analytics", analyticsRouter);

// Reset/reseed demo data — admin only
app.post("/api/reset-demo-data", requireRole("admin"), (req, res) => {
  db.reset();
  res.json({ ok: true });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  SkillTrack running: http://localhost:${PORT}\n`);
});
