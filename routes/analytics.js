const express = require("express");
const db = require("../db");
const { scopeProviderId } = require("../middleware/auth");
const router = express.Router();

function latestFollowupByTrainee(followups) {
  const map = new Map();
  followups
    .slice()
    .sort((a, b) => new Date(a.followup_date) - new Date(b.followup_date))
    .forEach((f) => map.set(f.trainee_id, f));
  return map;
}

// Returns trainees/placements/followups, filtered to the caller's own provider
// unless they're an admin (who sees everything).
function scopedData(req) {
  const myProviderId = scopeProviderId(req.user);
  let trainees = db.getAll("trainees");
  if (myProviderId) trainees = trainees.filter((t) => t.provider_id === myProviderId);
  const traineeIds = new Set(trainees.map((t) => t.id));
  const placements = db.getAll("placements").filter((p) => traineeIds.has(p.trainee_id));
  const followups = db.getAll("followups").filter((f) => traineeIds.has(f.trainee_id));
  return { trainees, placements, followups, myProviderId };
}

router.get("/summary", (req, res) => {
  const { trainees, placements, followups } = scopedData(req);

  const completed = trainees.filter((t) => t.completion_status === "Completed");
  const placedTraineeIds = new Set(placements.map((p) => p.trainee_id));
  const activePlacements = placements.filter((p) => p.employment_status === "Active");

  const wageValues = activePlacements.map((p) => p.monthly_wage_current).filter(Boolean);
  const avgWage = wageValues.length ? Math.round(wageValues.reduce((a, b) => a + b, 0) / wageValues.length) : 0;

  const wageGrowth = activePlacements
    .filter((p) => p.monthly_wage_start)
    .map((p) => ((p.monthly_wage_current - p.monthly_wage_start) / p.monthly_wage_start) * 100);
  const avgWageGrowthPct = wageGrowth.length ? Math.round(wageGrowth.reduce((a, b) => a + b, 0) / wageGrowth.length) : 0;

  const retentionEligible = placements.length;
  const retained = activePlacements.length;
  const retentionRate = retentionEligible ? Math.round((retained / retentionEligible) * 100) : 0;

  res.json({
    total_trainees: trainees.length,
    total_completed: completed.length,
    total_placed: placedTraineeIds.size,
    placement_rate_pct: completed.length ? Math.round((placedTraineeIds.size / completed.length) * 100) : 0,
    active_placements: activePlacements.length,
    retention_rate_pct: retentionRate,
    avg_monthly_wage: avgWage,
    avg_wage_growth_pct: avgWageGrowthPct,
    total_followups_logged: followups.length,
    verified_placements: placements.filter((p) => p.verification_status === "Verified").length,
    pending_verification: placements.filter((p) => p.verification_status === "Pending").length,
    disputed_placements: placements.filter((p) => p.verification_status === "Disputed").length
  });
});

router.get("/by-course", (req, res) => {
  const { trainees, placements, myProviderId } = scopedData(req);
  let courses = db.getAll("courses");
  if (myProviderId) courses = courses.filter((c) => c.provider_id === myProviderId);

  const rows = courses.map((c) => {
    const courseTrainees = trainees.filter((t) => t.course_id === c.id);
    const completed = courseTrainees.filter((t) => t.completion_status === "Completed");
    const placedIds = new Set(
      placements.filter((p) => courseTrainees.some((t) => t.id === p.trainee_id)).map((p) => p.trainee_id)
    );
    return {
      course_id: c.id,
      course_name: c.name,
      sector: c.sector,
      enrolled: courseTrainees.length,
      completed: completed.length,
      placed: placedIds.size,
      placement_rate_pct: completed.length ? Math.round((placedIds.size / completed.length) * 100) : 0
    };
  });
  res.json(rows);
});

router.get("/by-provider", (req, res) => {
  const { trainees, placements, myProviderId } = scopedData(req);
  let providers = db.getAll("providers");
  if (myProviderId) providers = providers.filter((p) => p.id === myProviderId);

  const rows = providers.map((p) => {
    const providerTrainees = trainees.filter((t) => t.provider_id === p.id);
    const completed = providerTrainees.filter((t) => t.completion_status === "Completed");
    const placedIds = new Set(
      placements.filter((pl) => providerTrainees.some((t) => t.id === pl.trainee_id)).map((pl) => pl.trainee_id)
    );
    return {
      provider_id: p.id,
      provider_name: p.name,
      district: p.district,
      enrolled: providerTrainees.length,
      completed: completed.length,
      placed: placedIds.size,
      placement_rate_pct: completed.length ? Math.round((placedIds.size / completed.length) * 100) : 0
    };
  });
  res.json(rows);
});

router.get("/by-district", (req, res) => {
  const { trainees, placements } = scopedData(req);
  const districts = [...new Set(trainees.map((t) => t.district).filter(Boolean))];

  const rows = districts.map((d) => {
    const districtTrainees = trainees.filter((t) => t.district === d);
    const completed = districtTrainees.filter((t) => t.completion_status === "Completed");
    const placedIds = new Set(
      placements.filter((p) => districtTrainees.some((t) => t.id === p.trainee_id)).map((p) => p.trainee_id)
    );
    return {
      district: d,
      enrolled: districtTrainees.length,
      completed: completed.length,
      placed: placedIds.size,
      placement_rate_pct: completed.length ? Math.round((placedIds.size / completed.length) * 100) : 0
    };
  });
  res.json(rows);
});

router.get("/outcome-distribution", (req, res) => {
  const scoped = scopedData(req);
  const trainees = scoped.trainees.filter((t) => t.completion_status === "Completed");
  const followups = scoped.followups;
  const latest = latestFollowupByTrainee(followups);

  const counts = {};
  trainees.forEach((t) => {
    const f = latest.get(t.id);
    const key = f ? f.status : "No follow-up yet";
    counts[key] = (counts[key] || 0) + 1;
  });
  res.json(Object.entries(counts).map(([status, count]) => ({ status, count })));
});

router.get("/attrition-reasons", (req, res) => {
  const { followups } = scopedData(req);
  const counts = {};
  followups.forEach((f) => {
    if (f.reason_if_not_placed) {
      counts[f.reason_if_not_placed] = (counts[f.reason_if_not_placed] || 0) + 1;
    }
  });
  res.json(
    Object.entries(counts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  );
});

router.get("/skill-gaps", (req, res) => {
  const { followups } = scopedData(req);
  const counts = {};
  followups.forEach((f) => {
    const tag = f.skill_gap_notes || "None reported";
    counts[tag] = (counts[tag] || 0) + 1;
  });
  res.json(
    Object.entries(counts)
      .map(([gap, count]) => ({ gap, count }))
      .sort((a, b) => b.count - a.count)
  );
});

router.get("/wage-trend", (req, res) => {
  const { placements } = scopedData(req);
  const buckets = { "0-6mo": [], "6-12mo": [], "12mo+": [] };
  const now = Date.now();
  placements.forEach((p) => {
    if (!p.start_date) return;
    const months = (now - new Date(p.start_date).getTime()) / (30 * 86400000);
    const growthPct = p.monthly_wage_start ? ((p.monthly_wage_current - p.monthly_wage_start) / p.monthly_wage_start) * 100 : 0;
    if (months < 6) buckets["0-6mo"].push(growthPct);
    else if (months < 12) buckets["6-12mo"].push(growthPct);
    else buckets["12mo+"].push(growthPct);
  });
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  res.json([
    { bucket: "0-6 months", avg_wage_growth_pct: avg(buckets["0-6mo"]) },
    { bucket: "6-12 months", avg_wage_growth_pct: avg(buckets["6-12mo"]) },
    { bucket: "12+ months", avg_wage_growth_pct: avg(buckets["12mo+"]) }
  ]);
});

module.exports = router;
