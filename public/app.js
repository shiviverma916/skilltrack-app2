const API = "/api";
let COURSES = [];
let PROVIDERS = [];
let charts = {};
let CURRENT_USER = null;

// ---------- auth-aware request helpers ----------
function authHeader() {
  const token = localStorage.getItem("skilltrack_token");
  return token ? { Authorization: "Bearer " + token } : {};
}
async function handle401(res) {
  if (res.status === 401) {
    localStorage.removeItem("skilltrack_token");
    showLogin();
    throw new Error("Session expired — please log in again");
  }
}
async function apiGet(path) {
  const res = await fetch(API + path, { headers: { ...authHeader() } });
  await handle401(res);
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}
async function apiPost(path, body, method = "POST") {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body)
  });
  await handle401(res);
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function apiDelete(path) {
  const res = await fetch(API + path, { method: "DELETE", headers: { ...authHeader() } });
  await handle401(res);
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
}

// ---------- login / logout ----------
function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appRoot").classList.add("hidden");
}
function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appRoot").classList.remove("hidden");
}

function applyRoleVisibility() {
  const isAdmin = CURRENT_USER.role === "admin";
  document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", !isAdmin));

  const roleLabel = { admin: "Admin", provider: "Training provider", field_staff: "Field staff" }[CURRENT_USER.role];
  const providerLine = CURRENT_USER.provider_name ? ` · ${CURRENT_USER.provider_name}` : "";
  document.getElementById("userBox").innerHTML = `
    <div class="u-name">${CURRENT_USER.name}</div>
    <div class="u-role">${roleLabel}${providerLine}</div>
  `;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const errEl = document.getElementById("loginError");
  errEl.classList.add("hidden");
  try {
    const res = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("skilltrack_token", data.token);
    CURRENT_USER = data.user;
    showApp();
    applyRoleVisibility();
    await init();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try { await apiPost("/auth/logout", {}); } catch (e) { /* ignore */ }
  localStorage.removeItem("skilltrack_token");
  CURRENT_USER = null;
  showLogin();
});

function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  const icon = isError
    ? '<svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16v.1"/></svg>'
    : '<svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5"/></svg>';
  t.innerHTML = icon + `<span>${msg}</span>`;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

function skeletonRows(colCount, rows = 4) {
  const cells = Array.from({ length: colCount }, () => `<td class="skel-row"><div class="skel-bar" style="width:${50 + Math.random() * 40}%"></div></td>`).join("");
  return Array.from({ length: rows }, () => `<tr>${cells}</tr>`).join("");
}

function emptyRow(colCount, message) {
  return `<tr class="empty-row"><td colspan="${colCount}">${message}</td></tr>`;
}

function updateTopbarMeta() {
  const el = document.getElementById("topbarMeta");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function pillClass(status) {
  const s = (status || "").toLowerCase();
  if (["active", "employed", "self-employed", "completed", "verified"].includes(s)) return "pill-teal";
  if (["pending", "enrolled"].includes(s)) return "pill-marigold";
  if (["left", "dropped out", "disputed", "unemployed", "not reachable"].includes(s)) return "pill-rust";
  return "pill-navy";
}

// ---------- nav ----------
const views = ["dashboard", "trainees", "placements", "followups", "skillgaps", "users"];
const viewTitles = {
  dashboard: ["Dashboard", "Programme, provider and district outcomes at a glance"],
  trainees: ["Trainees", "Consent-based trainee registry linked to courses and providers"],
  placements: ["Placements", "Wage employment, self-employment and apprenticeship outcomes"],
  followups: ["Follow-ups", "Automated reminders and assisted outcome check-ins"],
  skillgaps: ["Skill Gaps & Attrition", "What's blocking placement, and where courses fall short"],
  users: ["Users", "Manage provider-coordinator and field-staff accounts"]
};

document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const view = btn.dataset.view;
  views.forEach((v) => document.getElementById(`view-${v}`).classList.toggle("hidden", v !== view));
  document.getElementById("viewTitle").textContent = viewTitles[view][0];
  document.getElementById("viewSub").textContent = viewTitles[view][1];
  updateTopbarMeta();
  loadView(view);
});

function loadView(view) {
  if (view === "dashboard") loadDashboard();
  if (view === "trainees") loadTrainees();
  if (view === "placements") loadPlacements();
  if (view === "followups") loadFollowups();
  if (view === "skillgaps") loadSkillGaps();
  if (view === "users") loadUsers();
}

// ---------- dashboard ----------
async function loadDashboard() {
  const [summary, byCourse, byDistrict, byProvider, outcomes, wageTrend, attrition, skillGaps] = await Promise.all([
    apiGet("/analytics/summary"),
    apiGet("/analytics/by-course"),
    apiGet("/analytics/by-district"),
    apiGet("/analytics/by-provider"),
    apiGet("/analytics/outcome-distribution"),
    apiGet("/analytics/wage-trend"),
    apiGet("/analytics/attrition-reasons"),
    apiGet("/analytics/skill-gaps")
  ]);

  const ICONS = {
    users: '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6"/><circle cx="17" cy="8" r="2.4"/><path d="M15.5 14.2c2.6.3 4.5 2.6 4.5 5.8"/></svg>',
    briefcase: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
    shield: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.2 7.8-7 9-3.8-1.2-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    coin: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1 1-1.5 3-1.5s3 1 3 2-1 1.5-3 1.5-3 .5-3 1.5 1 2 3 2 3-.5 3-1.5"/></svg>',
    trend: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    flag: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>'
  };
  const kpis = [
    { label: "Trainees enrolled", value: summary.total_trainees, cls: "", icon: ICONS.users },
    { label: "Placement rate", value: `${summary.placement_rate_pct}%`, cls: "marigold", icon: ICONS.briefcase },
    { label: "Retention rate", value: `${summary.retention_rate_pct}%`, cls: "teal", icon: ICONS.shield },
    { label: "Avg. monthly wage", value: `₹${summary.avg_monthly_wage.toLocaleString("en-IN")}`, cls: "", icon: ICONS.coin },
    { label: "Avg. wage growth", value: `${summary.avg_wage_growth_pct}%`, cls: "teal", icon: ICONS.trend },
    { label: "Pending verification", value: summary.pending_verification, cls: "rust", icon: ICONS.flag }
  ];
  document.getElementById("kpiGrid").innerHTML = kpis
    .map(
      (k) => `<div class="kpi">
        <div class="kpi-top"><span class="kpi-label">${k.label}</span><span class="kpi-icon">${k.icon}</span></div>
        <div class="kpi-value ${k.cls}">${k.value}</div>
      </div>`
    )
    .join("");

  drawBarChart("chartByCourse", byCourse.map((r) => r.course_name), byCourse.map((r) => r.placement_rate_pct), "#C97A1F");
  drawBarChart("chartByDistrict", byDistrict.map((r) => r.district), byDistrict.map((r) => r.placement_rate_pct), "#2F6F62");
  drawDoughnut("chartOutcomes", outcomes.map((r) => r.status), outcomes.map((r) => r.count));
  drawBarChart("chartWageTrend", wageTrend.map((r) => r.bucket), wageTrend.map((r) => r.avg_wage_growth_pct), "#1B2A4A", "%");
  drawBarChart("chartAttrition", attrition.map((r) => r.reason), attrition.map((r) => r.count), "#A8452F", "", true);
  drawBarChart("chartSkillGaps", skillGaps.map((r) => r.gap), skillGaps.map((r) => r.count), "#3c4d70", "", true);

  const tbody = document.querySelector("#providerTable tbody");
  tbody.innerHTML = byProvider
    .map(
      (p) => `<tr>
        <td>${p.provider_name}</td><td>${p.district}</td><td>${p.enrolled}</td>
        <td>${p.completed}</td><td>${p.placed}</td>
        <td><span class="pill ${p.placement_rate_pct >= 50 ? "pill-teal" : "pill-marigold"}">${p.placement_rate_pct}%</span></td>
      </tr>`
    )
    .join("");
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function chartUnavailable(canvasId) {
  const canvas = document.getElementById(canvasId);
  const wrap = canvas.parentElement;
  wrap.style.height = "";
  canvas.style.display = "none";
  if (!wrap.querySelector(".chart-fallback")) {
    wrap.insertAdjacentHTML("beforeend", '<p class="chart-fallback" style="color:var(--ink-faint);font-size:12.5px;margin:0">Charts couldn\'t load — check your internet connection.</p>');
  }
}

function drawBarChart(canvasId, labels, data, color, suffix = "", horizontal = false) {
  if (typeof Chart === "undefined") return chartUnavailable(canvasId);
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4, maxBarThickness: 34 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.formattedValue}${suffix}` } } },
      scales: { x: { grid: { display: !horizontal } }, y: { grid: { display: horizontal } } },
      responsive: true, maintainAspectRatio: false
    }
  });
  document.getElementById(canvasId).parentElement.style.height = "260px";
}

function drawDoughnut(canvasId, labels, data) {
  if (typeof Chart === "undefined") return chartUnavailable(canvasId);
  destroyChart(canvasId);
  const palette = ["#2F6F62", "#C97A1F", "#A8452F", "#1B2A4A", "#928a7b", "#3c4d70"];
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: palette }] },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }, responsive: true, maintainAspectRatio: false }
  });
  document.getElementById(canvasId).parentElement.style.height = "260px";
}

// ---------- trainees ----------
async function loadTrainees() {
  const params = new URLSearchParams();
  const q = document.getElementById("traineeSearch").value;
  const district = document.getElementById("filterDistrict").value;
  const course_id = document.getElementById("filterCourse").value;
  const status = document.getElementById("filterStatus").value;
  if (q) params.set("q", q);
  if (district) params.set("district", district);
  if (course_id) params.set("course_id", course_id);
  if (status) params.set("status", status);

  const tbody = document.querySelector("#traineeTable tbody");
  tbody.innerHTML = skeletonRows(8);
  const trainees = await apiGet("/trainees?" + params.toString());
  tbody.innerHTML = trainees.length
    ? trainees
        .map(
          (t) => `<tr>
        <td>${t.name}</td><td class="mono">${t.phone}</td><td>${t.district}</td><td>${t.course_name || "—"}</td>
        <td><span class="pill ${pillClass(t.completion_status)}">${t.completion_status}</span></td>
        <td>${t.placement_status ? `<span class="pill ${pillClass(t.placement_status)}">${t.placement_type}</span>` : "—"}</td>
        <td>${t.latest_followup_status ? `<span class="pill ${pillClass(t.latest_followup_status)}">${t.latest_followup_status}</span>` : "—"}</td>
        <td><button class="link-btn" data-view-trainee="${t.id}">View</button></td>
      </tr>`
        )
        .join("")
    : emptyRow(8, "No trainees match these filters yet. Try clearing a filter, or register one above.");

  // populate filter dropdowns once
  const districtSel = document.getElementById("filterDistrict");
  if (districtSel.options.length <= 1) {
    const districts = [...new Set(trainees.map((t) => t.district))].sort();
    districts.forEach((d) => districtSel.insertAdjacentHTML("beforeend", `<option value="${d}">${d}</option>`));
  }
  const courseSel = document.getElementById("filterCourse");
  if (courseSel.options.length <= 1) {
    COURSES.forEach((c) => courseSel.insertAdjacentHTML("beforeend", `<option value="${c.id}">${c.name}</option>`));
  }
}
["traineeSearch", "filterDistrict", "filterCourse", "filterStatus"].forEach((id) => {
  document.getElementById(id).addEventListener("input", loadTrainees);
  document.getElementById(id).addEventListener("change", loadTrainees);
});

// ---------- placements ----------
async function loadPlacements() {
  const tbody = document.querySelector("#placementTable tbody");
  tbody.innerHTML = skeletonRows(8);
  const placements = await apiGet("/placements");
  tbody.innerHTML = placements.length
    ? placements
        .map(
          (p) => `<tr>
        <td>${p.trainee_name}</td><td>${p.type}</td><td>${p.employer_name}</td>
        <td>₹${p.monthly_wage_start.toLocaleString("en-IN")}</td><td>₹${p.monthly_wage_current.toLocaleString("en-IN")}</td>
        <td><span class="pill ${pillClass(p.employment_status)}">${p.employment_status}</span></td>
        <td><span class="pill ${pillClass(p.verification_status)}">${p.verification_status}</span></td>
        <td>${p.source}</td>
      </tr>`
        )
        .join("")
    : emptyRow(8, "No placements recorded yet. Record one above once a trainee completes and finds work.");
}

// ---------- followups ----------
async function loadFollowups() {
  const dueBody = document.querySelector("#dueTable tbody");
  const histBody = document.querySelector("#followupTable tbody");
  dueBody.innerHTML = skeletonRows(5, 2);
  histBody.innerHTML = skeletonRows(7);

  const [due, history] = await Promise.all([apiGet("/followups/due/list"), apiGet("/followups")]);

  dueBody.innerHTML = due.length
    ? due
        .map(
          (d) => `<tr>
        <td>${d.trainee.name}</td><td>${d.trainee.district}</td>
        <td>${d.last_followup ? d.last_followup.followup_date : "Never contacted"}</td>
        <td>${d.days_since_last_followup ?? "—"}</td>
        <td><button class="link-btn" data-log-followup="${d.trainee.id}">Log follow-up</button></td>
      </tr>`
        )
        .join("")
    : emptyRow(5, "No trainees currently due — the follow-up queue is clear.");

  histBody.innerHTML = history.length
    ? history
        .map(
          (f) => `<tr>
        <td>${f.trainee_name}</td><td>${f.followup_date}</td><td>${f.method}</td>
        <td><span class="pill ${pillClass(f.status)}">${f.status}</span></td>
        <td>${f.current_wage ? "₹" + f.current_wage.toLocaleString("en-IN") : "—"}</td>
        <td>${f.reason_if_not_placed || "—"}</td>
        <td>${f.skill_gap_notes}</td>
      </tr>`
        )
        .join("")
    : emptyRow(7, "No follow-ups logged yet.");
}

// ---------- skill gaps ----------
async function loadSkillGaps() {
  document.querySelector("#skillGapTable tbody").innerHTML = skeletonRows(2, 3);
  document.querySelector("#attritionTable tbody").innerHTML = skeletonRows(2, 3);
  const [gaps, attrition] = await Promise.all([apiGet("/analytics/skill-gaps"), apiGet("/analytics/attrition-reasons")]);
  document.querySelector("#skillGapTable tbody").innerHTML = gaps.length
    ? gaps.map((g) => `<tr><td>${g.gap}</td><td>${g.count}</td></tr>`).join("")
    : emptyRow(2, "No skill gaps logged yet.");
  document.querySelector("#attritionTable tbody").innerHTML = attrition.length
    ? attrition.map((a) => `<tr><td>${a.reason}</td><td>${a.count}</td></tr>`).join("")
    : emptyRow(2, "No non-placement reasons logged yet.");
}

// ---------- modals ----------
function openModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalBackdrop").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
}
document.getElementById("modalBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "modalBackdrop") closeModal();
});

function courseOptions() {
  return COURSES.map((c) => `<option value="${c.id}" data-provider="${c.provider_id}">${c.name}</option>`).join("");
}

document.getElementById("addTraineeBtn").addEventListener("click", () => {
  openModal(`
    <h2 class="serif">Register trainee</h2>
    <form id="traineeForm">
      <div class="two-col">
        <div class="form-row"><label>Full name *</label><input name="name" required></div>
        <div class="form-row"><label>Phone *</label><input name="phone" required pattern="[0-9]{10}" maxlength="10"></div>
      </div>
      <div class="two-col">
        <div class="form-row"><label>District</label><input name="district" placeholder="e.g. Lucknow"></div>
        <div class="form-row"><label>Gender</label>
          <select name="gender"><option>Female</option><option>Male</option><option>Other</option></select>
        </div>
      </div>
      <div class="form-row"><label>Course *</label><select name="course_id" required>${courseOptions()}</select></div>
      <div class="form-row"><label>Enrollment date</label><input type="date" name="enrollment_date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="form-row form-row-check">
        <input type="checkbox" name="consent_given" id="consentCheck" required>
        <label for="consentCheck" style="margin:0">Trainee has given informed consent to be tracked for employment outcomes</label>
      </div>
      <p class="form-error hidden" id="traineeFormError"></p>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save trainee</button>
      </div>
    </form>
  `);
  document.getElementById("traineeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const courseId = Number(fd.get("course_id"));
    const course = COURSES.find((c) => c.id === courseId);
    const body = {
      name: fd.get("name"), phone: fd.get("phone"), district: fd.get("district"),
      gender: fd.get("gender"), course_id: courseId, provider_id: course ? course.provider_id : null,
      enrollment_date: fd.get("enrollment_date"), consent_given: fd.get("consent_given") === "on"
    };
    try {
      await apiPost("/trainees", body);
      closeModal(); showToast("Trainee registered"); loadTrainees();
    } catch (err) {
      const el = document.getElementById("traineeFormError");
      el.textContent = err.message; el.classList.remove("hidden");
    }
  });
});

async function traineeOptionsHtml() {
  const trainees = await apiGet("/trainees?status=Completed");
  return trainees.map((t) => `<option value="${t.id}">${t.name} — ${t.district}</option>`).join("");
}

document.getElementById("addPlacementBtn").addEventListener("click", async () => {
  const options = await traineeOptionsHtml();
  openModal(`
    <h2 class="serif">Record placement</h2>
    <form id="placementForm">
      <div class="form-row"><label>Trainee *</label><select name="trainee_id" required>${options}</select></div>
      <div class="two-col">
        <div class="form-row"><label>Type *</label>
          <select name="type" required><option>Wage Employment</option><option>Self-Employment</option><option>Apprenticeship</option></select>
        </div>
        <div class="form-row"><label>Source</label>
          <select name="source"><option>Trainer Reported</option><option>Employer Verified</option><option>Trainee Reported</option><option>Call Center</option></select>
        </div>
      </div>
      <div class="form-row"><label>Employer name *</label><input name="employer_name" required></div>
      <div class="two-col">
        <div class="form-row"><label>Starting monthly wage (₹)</label><input type="number" name="monthly_wage_start" min="0"></div>
        <div class="form-row"><label>Current monthly wage (₹)</label><input type="number" name="monthly_wage_current" min="0"></div>
      </div>
      <div class="two-col">
        <div class="form-row"><label>Start date</label><input type="date" name="start_date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Status</label><select name="employment_status"><option>Active</option><option>Left</option></select></div>
      </div>
      <div class="form-row"><label>Verification status</label>
        <select name="verification_status"><option>Pending</option><option>Verified</option><option>Disputed</option></select>
      </div>
      <p class="form-error hidden" id="placementFormError"></p>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save placement</button>
      </div>
    </form>
  `);
  document.getElementById("placementForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await apiPost("/placements", body);
      closeModal(); showToast("Placement recorded"); loadPlacements();
    } catch (err) {
      const el = document.getElementById("placementFormError");
      el.textContent = err.message; el.classList.remove("hidden");
    }
  });
});

async function openFollowupModal(preselectTraineeId) {
  const trainees = await apiGet("/trainees?status=Completed");
  const options = trainees.map((t) => `<option value="${t.id}" ${String(t.id) === String(preselectTraineeId) ? "selected" : ""}>${t.name} — ${t.district}</option>`).join("");
  openModal(`
    <h2 class="serif">Log follow-up</h2>
    <form id="followupForm">
      <div class="form-row"><label>Trainee *</label><select name="trainee_id" required>${options}</select></div>
      <div class="two-col">
        <div class="form-row"><label>Method</label>
          <select name="method"><option>Call</option><option>SMS</option><option>WhatsApp</option><option>Field Visit</option></select>
        </div>
        <div class="form-row"><label>Follow-up date</label><input type="date" name="followup_date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="form-row"><label>Current status *</label>
        <select name="status" required>
          <option>Employed</option><option>Self-employed</option><option>Unemployed</option>
          <option>Further Education</option><option>Not Reachable</option>
        </select>
      </div>
      <div class="form-row"><label>Current monthly wage (₹, if employed)</label><input type="number" name="current_wage" min="0"></div>
      <div class="form-row"><label>Reason, if not placed</label>
        <select name="reason_if_not_placed">
          <option value="">—</option>
          <option>Family did not allow</option><option>Migrated / relocated</option>
          <option>Low wage offers</option><option>Skill mismatch with job market</option>
          <option>Awaiting better opportunity</option><option>Health issues</option>
          <option>Further studies</option><option>Not reachable</option>
        </select>
      </div>
      <div class="form-row"><label>Skill gap noted</label>
        <select name="skill_gap_notes">
          <option>None reported</option><option>Spoken English</option><option>Digital / computer literacy</option>
          <option>Customer handling</option><option>Advanced technical skill</option>
          <option>Workplace discipline / soft skills</option><option>Numeracy</option>
        </select>
      </div>
      <div class="form-row"><label>Satisfaction (1–5)</label><input type="number" name="satisfaction_score" min="1" max="5"></div>
      <p class="form-error hidden" id="followupFormError"></p>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save follow-up</button>
      </div>
    </form>
  `);
  document.getElementById("followupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await apiPost("/followups", body);
      closeModal(); showToast("Follow-up logged"); loadFollowups();
    } catch (err) {
      const el = document.getElementById("followupFormError");
      el.textContent = err.message; el.classList.remove("hidden");
    }
  });
}
document.getElementById("addFollowupBtn").addEventListener("click", () => openFollowupModal());
document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-log-followup]");
  if (btn) openFollowupModal(btn.dataset.logFollowup);
});

// trainee detail view (simple inline modal)
document.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-view-trainee]");
  if (!btn) return;
  const t = await apiGet(`/trainees/${btn.dataset.viewTrainee}`);
  openModal(`
    <h2 class="serif">${t.name}</h2>
    <p class="mono" style="color:var(--ink-soft);font-size:12px;margin-top:-8px">${t.phone} · ${t.district}</p>
    <p><strong>Course:</strong> ${t.course ? t.course.name : "—"} &nbsp; <strong>Provider:</strong> ${t.provider ? t.provider.name : "—"}</p>
    <p><strong>Status:</strong> <span class="pill ${pillClass(t.completion_status)}">${t.completion_status}</span></p>
    <h3 style="margin-top:18px">Placements</h3>
    ${t.placements.length ? t.placements.map((p) => `<p>${p.type} at ${p.employer_name} — ₹${p.monthly_wage_current}/mo — <span class="pill ${pillClass(p.employment_status)}">${p.employment_status}</span></p>`).join("") : "<p style='color:var(--ink-faint)'>No placement recorded yet.</p>"}
    <h3 style="margin-top:18px">Follow-up history</h3>
    ${t.followups.length ? t.followups.map((f) => `<p>${f.followup_date} · ${f.method} · <span class="pill ${pillClass(f.status)}">${f.status}</span> ${f.reason_if_not_placed ? "— " + f.reason_if_not_placed : ""}</p>`).join("") : "<p style='color:var(--ink-faint)'>No follow-ups logged yet.</p>"}
    <div class="form-actions"><button class="btn-secondary" onclick="closeModal()">Close</button></div>
  `);
});

// ---------- users (admin only) ----------
async function loadUsers() {
  const tbody = document.querySelector("#userTable tbody");
  tbody.innerHTML = skeletonRows(5, 3);
  const users = await apiGet("/users");
  tbody.innerHTML = users
    .map(
      (u) => `<tr>
        <td>${u.name}</td><td class="mono">${u.username}</td>
        <td><span class="pill pill-navy">${u.role.replace("_", " ")}</span></td>
        <td>${u.provider_name || "—"}</td>
        <td>${u.id === CURRENT_USER.id ? "" : `<button class="link-btn" data-delete-user="${u.id}">Remove</button>`}</td>
      </tr>`
    )
    .join("");
}

document.getElementById("addUserBtn").addEventListener("click", () => {
  const providerOptions = PROVIDERS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  openModal(`
    <h2 class="serif">Add user</h2>
    <form id="userForm">
      <div class="form-row"><label>Full name *</label><input name="name" required></div>
      <div class="two-col">
        <div class="form-row"><label>Username *</label><input name="username" required></div>
        <div class="form-row"><label>Password *</label><input type="password" name="password" required minlength="4"></div>
      </div>
      <div class="form-row"><label>Role *</label>
        <select name="role" id="userRoleSelect" required>
          <option value="admin">Admin — full access</option>
          <option value="provider" selected>Training provider — scoped to one provider</option>
          <option value="field_staff">Field staff — scoped to one provider</option>
        </select>
      </div>
      <div class="form-row" id="userProviderRow"><label>Provider *</label><select name="provider_id">${providerOptions}</select></div>
      <p class="form-error hidden" id="userFormError"></p>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create user</button>
      </div>
    </form>
  `);
  document.getElementById("userRoleSelect").addEventListener("change", (e) => {
    document.getElementById("userProviderRow").classList.toggle("hidden", e.target.value === "admin");
  });
  document.getElementById("userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await apiPost("/users", body);
      closeModal(); showToast("User created"); loadUsers();
    } catch (err) {
      const el = document.getElementById("userFormError");
      el.textContent = err.message; el.classList.remove("hidden");
    }
  });
});

document.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-delete-user]");
  if (!btn) return;
  if (!confirm("Remove this user account?")) return;
  try {
    await apiDelete(`/users/${btn.dataset.deleteUser}`);
    showToast("User removed"); loadUsers();
  } catch (err) {
    showToast(err.message);
  }
});

// ---------- reset demo data ----------
document.getElementById("resetDemoBtn").addEventListener("click", async () => {
  if (!confirm("This will regenerate all demo data and discard anything you've added. Continue?")) return;
  await apiPost("/reset-demo-data", {});
  showToast("Demo data reset");
  loadView("dashboard");
});

// ---------- init / boot ----------
async function init() {
  [COURSES, PROVIDERS] = await Promise.all([apiGet("/courses"), apiGet("/providers")]);
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  document.querySelector('.nav-item[data-view="dashboard"]').classList.add("active");
  views.forEach((v) => document.getElementById(`view-${v}`).classList.toggle("hidden", v !== "dashboard"));
  document.getElementById("viewTitle").textContent = viewTitles.dashboard[0];
  document.getElementById("viewSub").textContent = viewTitles.dashboard[1];
  updateTopbarMeta();
  loadDashboard();
}

async function boot() {
  const token = localStorage.getItem("skilltrack_token");
  if (!token) return showLogin();
  try {
    CURRENT_USER = await apiGet("/auth/me");
    showApp();
    applyRoleVisibility();
    await init();
  } catch (err) {
    showLogin();
  }
}
boot();
