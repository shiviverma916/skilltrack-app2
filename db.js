// db.js — a tiny zero-dependency, file-backed JSON "database".
// This avoids native modules (like sqlite3/better-sqlite3) so `npm install`
// works out of the box on any OS in VS Code with no build tools required.

const fs = require("fs");
const path = require("path");
const { hashPassword } = require("./utils/crypto");

const DB_PATH = path.join(__dirname, "data", "db.json");

function seedData() {
  const providers = [
    { id: 1, name: "Pragati Skills Foundation", district: "Lucknow", state: "Uttar Pradesh" },
    { id: 2, name: "Udaan Vocational Institute", district: "Kanpur", state: "Uttar Pradesh" },
    { id: 3, name: "Disha Livelihoods Trust", district: "Varanasi", state: "Uttar Pradesh" },
    { id: 4, name: "Setu Skilling Centre", district: "Prayagraj", state: "Uttar Pradesh" }
  ];

  const courses = [
    { id: 1, name: "Retail Sales Associate", sector: "Retail", duration_weeks: 8, provider_id: 1 },
    { id: 2, name: "Electrical Technician (Domestic)", sector: "Electrical", duration_weeks: 12, provider_id: 1 },
    { id: 3, name: "Beautician & Wellness", sector: "Beauty & Wellness", duration_weeks: 10, provider_id: 2 },
    { id: 4, name: "IT-ITeS Helpdesk Support", sector: "IT-ITeS", duration_weeks: 10, provider_id: 3 },
    { id: 5, name: "Tailoring & Apparel Making", sector: "Apparel", duration_weeks: 8, provider_id: 4 },
    { id: 6, name: "Field Sales Executive", sector: "Sales", duration_weeks: 6, provider_id: 2 }
  ];

  const genders = ["Female", "Male", "Other"];
  const districts = ["Lucknow", "Kanpur", "Varanasi", "Prayagraj", "Gorakhpur"];
  const firstNames = ["Anita", "Ravi", "Pooja", "Suresh", "Kavita", "Manoj", "Neha", "Ajay", "Sunita", "Vikram", "Rekha", "Deepak", "Shalini", "Arun", "Priya", "Sanjay", "Meena", "Rahul", "Geeta", "Vinod"];
  const lastNames = ["Kumar", "Singh", "Verma", "Yadav", "Sharma", "Gupta", "Devi", "Prasad", "Rawat", "Mishra"];

  const trainees = [];
  let tid = 1;
  for (let i = 0; i < 24; i++) {
    const course = courses[i % courses.length];
    const enrollDaysAgo = 60 + Math.floor(Math.random() * 300);
    const enrollDate = new Date(Date.now() - enrollDaysAgo * 86400000);
    trainees.push({
      id: tid,
      name: `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`,
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      alt_phone: "",
      email: "",
      gender: genders[i % genders.length === 2 && Math.random() > 0.3 ? Math.floor(Math.random() * 2) : i % genders.length],
      dob: "",
      district: districts[i % districts.length],
      state: "Uttar Pradesh",
      course_id: course.id,
      provider_id: course.provider_id,
      enrollment_date: enrollDate.toISOString().slice(0, 10),
      completion_status: i % 9 === 0 ? "Dropped Out" : "Completed",
      consent_given: true,
      consent_date: enrollDate.toISOString().slice(0, 10),
      id_proof_type: "Aadhaar",
      id_proof_last4: String(1000 + Math.floor(Math.random() * 8999)),
      created_at: new Date().toISOString()
    });
    tid++;
  }

  const placementTypes = ["Wage Employment", "Self-Employment", "Apprenticeship"];
  const sources = ["Trainer Reported", "Employer Verified", "Trainee Reported", "Call Center"];
  const verifStatuses = ["Verified", "Pending", "Disputed"];
  const employers = ["Reliance Retail", "Self-employed / Own Enterprise", "Bajaj Electricals Service Partner", "Urban Company", "Local Tailoring Unit", "TCS BPS", "Big Bazaar", "HDFC Bank BC Partner", "Local Salon Chain"];

  const placements = [];
  let pid = 1;
  trainees.forEach((t) => {
    if (t.completion_status === "Completed" && Math.random() < 0.68) {
      const startDaysAgo = Math.max(5, Math.floor(Math.random() * 200));
      const startDate = new Date(Date.now() - startDaysAgo * 86400000);
      const stillActive = Math.random() < 0.78;
      placements.push({
        id: pid,
        trainee_id: t.id,
        type: placementTypes[Math.floor(Math.random() * placementTypes.length)],
        employer_name: employers[Math.floor(Math.random() * employers.length)],
        employer_contact: `8${Math.floor(100000000 + Math.random() * 899999999)}`,
        job_role: "Associate",
        sector: courses.find((c) => c.id === t.course_id).sector,
        monthly_wage_start: 6000 + Math.floor(Math.random() * 6000),
        monthly_wage_current: 6500 + Math.floor(Math.random() * 9000),
        start_date: startDate.toISOString().slice(0, 10),
        employment_status: stillActive ? "Active" : "Left",
        left_reason: stillActive ? "" : ["Low wages", "Relocated", "Family reasons", "Found better job", "Workplace issues"][Math.floor(Math.random() * 5)],
        verification_status: verifStatuses[Math.floor(Math.random() * verifStatuses.length)],
        source: sources[Math.floor(Math.random() * sources.length)],
        created_at: new Date().toISOString()
      });
      pid++;
    }
  });

  const followupMethods = ["Call", "SMS", "WhatsApp", "Field Visit"];
  const nonPlacementReasons = ["Family did not allow", "Migrated / relocated", "Low wage offers", "Skill mismatch with job market", "Awaiting better opportunity", "Health issues", "Further studies", "Not reachable"];
  const skillGapTags = ["Spoken English", "Digital / computer literacy", "Customer handling", "Advanced technical skill", "Workplace discipline / soft skills", "Numeracy", "None reported"];

  const followups = [];
  let fid = 1;
  trainees.forEach((t) => {
    if (t.completion_status !== "Completed") return;
    const numFollowups = 1 + Math.floor(Math.random() * 2);
    const placement = placements.find((p) => p.trainee_id === t.id);
    for (let k = 0; k < numFollowups; k++) {
      const daysAgo = Math.floor(Math.random() * 150);
      let status;
      if (placement) {
        status = placement.employment_status === "Active"
          ? (placement.type === "Self-Employment" ? "Self-employed" : "Employed")
          : "Unemployed";
      } else {
        status = Math.random() < 0.5 ? "Unemployed" : (Math.random() < 0.5 ? "Further Education" : "Not Reachable");
      }
      followups.push({
        id: fid,
        trainee_id: t.id,
        followup_date: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
        method: followupMethods[Math.floor(Math.random() * followupMethods.length)],
        status,
        current_wage: status === "Employed" || status === "Self-employed" ? (placement ? placement.monthly_wage_current : 7000) : 0,
        reason_if_not_placed: (status === "Unemployed" || status === "Not Reachable") ? nonPlacementReasons[Math.floor(Math.random() * nonPlacementReasons.length)] : "",
        skill_gap_notes: Math.random() < 0.55 ? skillGapTags[Math.floor(Math.random() * skillGapTags.length)] : "None reported",
        satisfaction_score: 1 + Math.floor(Math.random() * 5),
        created_at: new Date().toISOString()
      });
      fid++;
    }
  });

  const users = [
    { id: 1, username: "admin", password: hashPassword("admin123"), name: "Programme Admin", role: "admin", provider_id: null },
    { id: 2, username: "provider1", password: hashPassword("provider123"), name: "Pragati Skills — Coordinator", role: "provider", provider_id: 1 },
    { id: 3, username: "provider2", password: hashPassword("provider123"), name: "Udaan Vocational — Coordinator", role: "provider", provider_id: 2 },
    { id: 4, username: "fieldstaff1", password: hashPassword("field123"), name: "Field Staff — Lucknow", role: "field_staff", provider_id: 1 }
  ];

  return {
    meta: {
      nextIds: {
        trainees: tid,
        providers: providers.length + 1,
        courses: courses.length + 1,
        placements: pid,
        followups: fid,
        users: users.length + 1
      }
    },
    providers,
    courses,
    trainees,
    placements,
    followups,
    users
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = seedData();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const loaded = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  // Migration safeguard: if this is a db.json saved before login/roles were
  // added, it won't have a "users" table yet — seed one in without touching
  // any existing trainee/placement/followup data.
  if (!loaded.users) {
    const fresh = seedData();
    loaded.users = fresh.users;
    loaded.meta.nextIds.users = fresh.users.length + 1;
    fs.writeFileSync(DB_PATH, JSON.stringify(loaded, null, 2));
  }
  return loaded;
}

let state = load();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

function nextId(table) {
  const id = state.meta.nextIds[table];
  state.meta.nextIds[table] = id + 1;
  return id;
}

function getAll(table) {
  return state[table];
}

function getById(table, id) {
  return state[table].find((r) => r.id === Number(id));
}

function insert(table, record) {
  const id = nextId(table);
  const row = { id, ...record, created_at: new Date().toISOString() };
  state[table].push(row);
  save();
  return row;
}

function update(table, id, patch) {
  const idx = state[table].findIndex((r) => r.id === Number(id));
  if (idx === -1) return null;
  state[table][idx] = { ...state[table][idx], ...patch };
  save();
  return state[table][idx];
}

function remove(table, id) {
  const idx = state[table].findIndex((r) => r.id === Number(id));
  if (idx === -1) return false;
  state[table].splice(idx, 1);
  save();
  return true;
}

function reset() {
  state = seedData();
  save();
  return state;
}

module.exports = { getAll, getById, insert, update, remove, reset };
