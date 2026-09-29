const express = require("express");
const db = require("../db");
const { scopeProviderId } = require("../middleware/auth");
const router = express.Router();

// GET /api/trainees?district=&course_id=&provider_id=&status=&q=
router.get("/", (req, res) => {
  let rows = db.getAll("trainees");
  const { district, course_id, provider_id, status, q } = req.query;
  const myProviderId = scopeProviderId(req.user);

  // Non-admins are always restricted to their own provider, regardless of query params.
  if (myProviderId) rows = rows.filter((t) => t.provider_id === myProviderId);
  else if (provider_id) rows = rows.filter((t) => t.provider_id === Number(provider_id));

  if (district) rows = rows.filter((t) => t.district === district);
  if (course_id) rows = rows.filter((t) => t.course_id === Number(course_id));
  if (status) rows = rows.filter((t) => t.completion_status === status);
  if (q) {
    const query = q.toLowerCase();
    rows = rows.filter(
      (t) => t.name.toLowerCase().includes(query) || t.phone.includes(query)
    );
  }

  // Enrich with course/provider names + latest placement + latest followup summary
  const courses = db.getAll("courses");
  const providers = db.getAll("providers");
  const placements = db.getAll("placements");
  const followups = db.getAll("followups");

  const enriched = rows.map((t) => {
    const course = courses.find((c) => c.id === t.course_id);
    const provider = providers.find((p) => p.id === t.provider_id);
    const placement = placements.find((p) => p.trainee_id === t.id);
    const traineeFollowups = followups
      .filter((f) => f.trainee_id === t.id)
      .sort((a, b) => new Date(b.followup_date) - new Date(a.followup_date));
    return {
      ...t,
      course_name: course ? course.name : null,
      provider_name: provider ? provider.name : null,
      placement_status: placement ? placement.employment_status : null,
      placement_type: placement ? placement.type : null,
      latest_followup_status: traineeFollowups[0] ? traineeFollowups[0].status : null,
      latest_followup_date: traineeFollowups[0] ? traineeFollowups[0].followup_date : null
    };
  });

  res.json(enriched);
});

router.get("/:id", (req, res) => {
  const trainee = db.getById("trainees", req.params.id);
  if (!trainee) return res.status(404).json({ error: "Trainee not found" });
  const myProviderId = scopeProviderId(req.user);
  if (myProviderId && trainee.provider_id !== myProviderId) {
    return res.status(403).json({ error: "You don't have access to this trainee" });
  }

  const placements = db.getAll("placements").filter((p) => p.trainee_id === trainee.id);
  const followups = db
    .getAll("followups")
    .filter((f) => f.trainee_id === trainee.id)
    .sort((a, b) => new Date(b.followup_date) - new Date(a.followup_date));
  const course = db.getById("courses", trainee.course_id);
  const provider = db.getById("providers", trainee.provider_id);

  res.json({ ...trainee, course, provider, placements, followups });
});

router.post("/", (req, res) => {
  const body = req.body;
  if (!body.name || !body.phone) {
    return res.status(400).json({ error: "name and phone are required" });
  }
  if (!body.consent_given) {
    return res.status(400).json({ error: "Consent must be captured before creating a trainee record" });
  }

  const myProviderId = scopeProviderId(req.user);
  const providerId = myProviderId || Number(body.provider_id) || null;

  // Non-admins can only enroll trainees into a course run by their own provider.
  const courseId = Number(body.course_id) || null;
  if (courseId) {
    const course = db.getById("courses", courseId);
    if (!course) return res.status(400).json({ error: "Course not found" });
    if (myProviderId && course.provider_id !== myProviderId) {
      return res.status(403).json({ error: "You can only enroll trainees into your own provider's courses" });
    }
  }

  const record = {
    name: body.name,
    phone: body.phone,
    alt_phone: body.alt_phone || "",
    email: body.email || "",
    gender: body.gender || "",
    dob: body.dob || "",
    district: body.district || "",
    state: body.state || "Uttar Pradesh",
    course_id: courseId,
    provider_id: providerId,
    enrollment_date: body.enrollment_date || new Date().toISOString().slice(0, 10),
    completion_status: body.completion_status || "Enrolled",
    consent_given: true,
    consent_date: new Date().toISOString().slice(0, 10),
    id_proof_type: body.id_proof_type || "",
    id_proof_last4: body.id_proof_last4 || ""
  };
  const row = db.insert("trainees", record);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const trainee = db.getById("trainees", req.params.id);
  if (!trainee) return res.status(404).json({ error: "Trainee not found" });
  const myProviderId = scopeProviderId(req.user);
  if (myProviderId && trainee.provider_id !== myProviderId) {
    return res.status(403).json({ error: "You don't have access to this trainee" });
  }
  if (req.user.role === "field_staff") {
    return res.status(403).json({ error: "Field staff can't edit trainee records, only add follow-ups and placements" });
  }
  const updated = db.update("trainees", req.params.id, req.body);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Only an admin can delete trainee records" });
  }
  const ok = db.remove("trainees", req.params.id);
  if (!ok) return res.status(404).json({ error: "Trainee not found" });
  res.status(204).end();
});

module.exports = router;
