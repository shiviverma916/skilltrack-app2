const express = require("express");
const db = require("../db");
const { scopeProviderId } = require("../middleware/auth");
const router = express.Router();

router.get("/", (req, res) => {
  const myProviderId = scopeProviderId(req.user);
  let placements = db.getAll("placements");
  const trainees = db.getAll("trainees");

  if (myProviderId) {
    const myTraineeIds = new Set(trainees.filter((t) => t.provider_id === myProviderId).map((t) => t.id));
    placements = placements.filter((p) => myTraineeIds.has(p.trainee_id));
  }

  const enriched = placements.map((p) => {
    const t = trainees.find((tr) => tr.id === p.trainee_id);
    return { ...p, trainee_name: t ? t.name : null, trainee_district: t ? t.district : null };
  });
  res.json(enriched);
});

router.post("/", (req, res) => {
  const body = req.body;
  if (!body.trainee_id || !body.type || !body.employer_name) {
    return res.status(400).json({ error: "trainee_id, type and employer_name are required" });
  }
  const trainee = db.getById("trainees", body.trainee_id);
  if (!trainee) return res.status(404).json({ error: "Trainee not found" });

  const myProviderId = scopeProviderId(req.user);
  if (myProviderId && trainee.provider_id !== myProviderId) {
    return res.status(403).json({ error: "You can only record placements for your own provider's trainees" });
  }
  // Field staff can log a placement but can't mark it as already Verified —
  // verification is a provider/admin call.
  if (req.user.role === "field_staff" && body.verification_status === "Verified") {
    body.verification_status = "Pending";
  }

  const record = {
    trainee_id: Number(body.trainee_id),
    type: body.type,
    employer_name: body.employer_name,
    employer_contact: body.employer_contact || "",
    job_role: body.job_role || "",
    sector: body.sector || "",
    monthly_wage_start: Number(body.monthly_wage_start) || 0,
    monthly_wage_current: Number(body.monthly_wage_current) || Number(body.monthly_wage_start) || 0,
    start_date: body.start_date || new Date().toISOString().slice(0, 10),
    employment_status: body.employment_status || "Active",
    left_reason: body.left_reason || "",
    verification_status: body.verification_status || "Pending",
    source: body.source || "Trainer Reported"
  };
  const row = db.insert("placements", record);

  // Auto-update trainee completion status to reflect a placement exists
  db.update("trainees", trainee.id, { completion_status: "Completed" });

  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  // Editing / verifying a placement is an admin or provider-coordinator action.
  if (req.user.role === "field_staff") {
    return res.status(403).json({ error: "Field staff can't edit or verify placements" });
  }
  const placement = db.getById("placements", req.params.id);
  if (!placement) return res.status(404).json({ error: "Placement not found" });
  const myProviderId = scopeProviderId(req.user);
  if (myProviderId) {
    const trainee = db.getById("trainees", placement.trainee_id);
    if (!trainee || trainee.provider_id !== myProviderId) {
      return res.status(403).json({ error: "You don't have access to this placement" });
    }
  }
  const updated = db.update("placements", req.params.id, req.body);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only an admin can delete placement records" });
  }
  const ok = db.remove("placements", req.params.id);
  if (!ok) return res.status(404).json({ error: "Placement not found" });
  res.status(204).end();
});

module.exports = router;
