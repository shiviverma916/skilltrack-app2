const express = require("express");
const db = require("../db");
const { scopeProviderId } = require("../middleware/auth");
const router = express.Router();

router.get("/", (req, res) => {
  const myProviderId = scopeProviderId(req.user);
  let followups = db.getAll("followups");
  const trainees = db.getAll("trainees");

  if (myProviderId) {
    const myTraineeIds = new Set(trainees.filter((t) => t.provider_id === myProviderId).map((t) => t.id));
    followups = followups.filter((f) => myTraineeIds.has(f.trainee_id));
  }

  const enriched = followups
    .map((f) => {
      const t = trainees.find((tr) => tr.id === f.trainee_id);
      return { ...f, trainee_name: t ? t.name : null, trainee_district: t ? t.district : null };
    })
    .sort((a, b) => new Date(b.followup_date) - new Date(a.followup_date));
  res.json(enriched);
});

router.post("/", (req, res) => {
  const body = req.body;
  if (!body.trainee_id || !body.status) {
    return res.status(400).json({ error: "trainee_id and status are required" });
  }
  const trainee = db.getById("trainees", body.trainee_id);
  if (!trainee) return res.status(404).json({ error: "Trainee not found" });

  const myProviderId = scopeProviderId(req.user);
  if (myProviderId && trainee.provider_id !== myProviderId) {
    return res.status(403).json({ error: "You can only log follow-ups for your own provider's trainees" });
  }

  const record = {
    trainee_id: Number(body.trainee_id),
    followup_date: body.followup_date || new Date().toISOString().slice(0, 10),
    method: body.method || "Call",
    status: body.status,
    current_wage: Number(body.current_wage) || 0,
    reason_if_not_placed: body.reason_if_not_placed || "",
    skill_gap_notes: body.skill_gap_notes || "None reported",
    satisfaction_score: Number(body.satisfaction_score) || null
  };
  const row = db.insert("followups", record);
  res.status(201).json(row);
});

// Trainees "due" for a follow-up: completed >= 30 days ago (or last followup >= 60 days ago) and not contacted recently.
// This simulates the "automated + assisted follow-up" reminder queue.
router.get("/due/list", (req, res) => {
  const myProviderId = scopeProviderId(req.user);
  let trainees = db.getAll("trainees").filter((t) => t.completion_status === "Completed");
  if (myProviderId) trainees = trainees.filter((t) => t.provider_id === myProviderId);
  const followups = db.getAll("followups");
  const now = Date.now();

  const due = trainees
    .map((t) => {
      const tf = followups
        .filter((f) => f.trainee_id === t.id)
        .sort((a, b) => new Date(b.followup_date) - new Date(a.followup_date));
      const last = tf[0];
      const daysSinceEnroll = Math.floor((now - new Date(t.enrollment_date).getTime()) / 86400000);
      const daysSinceLastFollowup = last ? Math.floor((now - new Date(last.followup_date).getTime()) / 86400000) : null;
      const isDue = !last ? daysSinceEnroll >= 30 : daysSinceLastFollowup >= 60;
      return { trainee: t, last_followup: last || null, days_since_last_followup: daysSinceLastFollowup, isDue };
    })
    .filter((r) => r.isDue);

  res.json(due);
});

module.exports = router;
