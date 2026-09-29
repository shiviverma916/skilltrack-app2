# SkillTrack — Skilling Outcomes & Impact Console

A working full-stack prototype for the problem statement *"Difficulties in tracking
employment outcomes, skill gaps, and the impact of skilling initiatives."*

It gives you a consent-based trainee registry linked to courses/providers, placement
(wage employment / self-employment / apprenticeship) records with employer
verification status, a follow-up log (with an automated "due for follow-up" queue),
skill-gap and attrition-reason tagging, and a cohort/course/provider/district
analytics dashboard.

## Stack
- **Backend:** Node.js + Express, REST API under `/api/*`
- **Database:** a tiny zero-dependency JSON file store (`data/db.json`) — no native
  modules, no separate DB server to install. Swap this for Postgres/MySQL later
  without touching the frontend (see "Moving to a real database" below).
- **Frontend:** plain HTML/CSS/JS (no build step), served by Express as static files,
  charts via Chart.js from a CDN.

## Run it in VS Code

1. Install [Node.js](https://nodejs.org) 16+ if you don't have it (`node -v` to check).
2. Open this folder (`skilltrack-app`) in VS Code.
3. Open a terminal (`Ctrl+`` `` `` `` ` ` or Terminal → New Terminal) and run:
   ```bash
   npm install
   npm start
   ```
4. Open **http://localhost:3000** in your browser. That's it — one process serves
   both the API and the web page.

The first time it runs, it auto-generates realistic seed data (trainees, courses,
providers, placements, follow-ups) into `data/db.json` so the dashboard isn't empty.
Click **"↻ Reset demo data"** in the sidebar any time to regenerate it.

To change the port: `PORT=4000 npm start`.

## What's in the app

- **Dashboard** — KPIs (placement rate, retention rate, avg. wage, wage growth,
  pending verifications), charts by course/district/outcome/wage-tenure, and a
  provider accountability table.
- **Trainees** — searchable/filterable registry; "Register trainee" requires an
  explicit consent checkbox before a record can be created (privacy-conscious by
  design — the API rejects the request otherwise).
- **Placements** — record wage employment, self-employment or apprenticeship
  outcomes with employer contact, wage-at-start vs. wage-now, and a verification
  status (Pending/Verified/Disputed) so you can track employer-information quality.
- **Follow-ups** — a "due for follow-up" queue (auto-computed: no follow-up 30+
  days after completion, or last follow-up 60+ days ago) simulating the
  automated/assisted outcome check-in cadence, plus full follow-up history capturing
  status, wage, non-placement reason, and skill gap noted.
- **Skill Gaps & Attrition** — aggregated tallies of what's blocking placement and
  which skills trainees/employers flag as missing, to steer curriculum fixes.

## API reference

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/trainees` | list (with `?q=&district=&course_id=&status=`) / register |
| GET/PUT/DELETE | `/api/trainees/:id` | trainee detail (incl. placements & follow-ups) / update / remove |
| GET/POST | `/api/courses`, `/api/providers` | catalog |
| GET/POST/PUT/DELETE | `/api/placements(/:id)` | employment outcome records |
| GET/POST | `/api/followups` | follow-up log |
| GET | `/api/followups/due/list` | trainees due for a check-in |
| GET | `/api/analytics/summary` | headline KPIs |
| GET | `/api/analytics/by-course` \| `by-provider` \| `by-district` | cohort breakdowns |
| GET | `/api/analytics/outcome-distribution` \| `wage-trend` \| `attrition-reasons` \| `skill-gaps` | dashboard charts |
| POST | `/api/reset-demo-data` | regenerate seed data |

All endpoints return/accept JSON.

## Project structure
```
skilltrack-app/
├── server.js              # Express app entry point
├── db.js                  # file-backed JSON store + seed data generator
├── routes/
│   ├── trainees.js
│   ├── catalog.js         # courses + providers
│   ├── placements.js
│   ├── followups.js
│   └── analytics.js
├── public/                # frontend (served statically)
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── data/db.json           # auto-created on first run
```

## Moving to a real database

For a real deployment, swap `db.js` for a proper database (Postgres is a good fit
given the relational trainee → course/provider → placement → follow-up structure).
Since every route only calls `db.getAll`, `db.getById`, `db.insert`, `db.update` and
`db.remove`, you can reimplement those five functions against Postgres/MySQL
(e.g. with `pg` or an ORM like Prisma) without changing any route or frontend code.

## Extending toward the full brief

This prototype demonstrates the core workflow end-to-end. Production-grade next
steps the brief calls for for that aren't built here: SMS/IVR-based automated
follow-up dispatch (e.g. via Twilio/MSG91), a unique trainee ID scheme to
de-duplicate across programmes, role-based access control for provider/government
users, employer-side self-service verification portal, and offline-capable data
collection for field verification visits.
