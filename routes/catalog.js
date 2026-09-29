const express = require("express");
const db = require("../db");
const { requireRole } = require("../middleware/auth");
const router = express.Router();

// ---- Providers ----
// Everyone can list providers (needed for dropdowns); only an admin can create one.
router.get("/providers", (req, res) => res.json(db.getAll("providers")));

router.post("/providers", requireRole("admin"), (req, res) => {
  const { name, district, state } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const row = db.insert("providers", { name, district: district || "", state: state || "Uttar Pradesh" });
  res.status(201).json(row);
});

// ---- Courses ----
router.get("/courses", (req, res) => {
  const courses = db.getAll("courses");
  const providers = db.getAll("providers");
  const enriched = courses.map((c) => ({
    ...c,
    provider_name: (providers.find((p) => p.id === c.provider_id) || {}).name || null
  }));
  res.json(enriched);
});

router.post("/courses", requireRole("admin", "provider"), (req, res) => {
  const { name, sector, duration_weeks } = req.body;
  let { provider_id } = req.body;
  // A provider coordinator can only add courses under their own provider.
  if (req.user.role === "provider") provider_id = req.user.provider_id;
  if (!name || !provider_id) return res.status(400).json({ error: "name and provider_id are required" });
  const row = db.insert("courses", {
    name,
    sector: sector || "",
    duration_weeks: Number(duration_weeks) || 0,
    provider_id: Number(provider_id)
  });
  res.status(201).json(row);
});

module.exports = router;
