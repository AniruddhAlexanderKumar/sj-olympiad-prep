# Axiom Olympiad Learning

A functioning, mastery-first learning app for competition mathematics. AMC 10 is the initial student journey; the data model and admin studio support separate competitions, syllabi, question banks, and assessment blueprints. The included lessons and problems are original sample material, not official AMC syllabus or past-paper content.

## Run locally

Requirements: Node.js 22.13.1 or newer and npm.

```sh
npm install
npm run dev
```

The local development server uses SQLite at `data/axiom.sqlite` by default, applies the SQL migrations, and seeds the sample curriculum on startup. Set `DATABASE_PATH` to use another SQLite file. The web app runs on port 5173 and proxies `/api` to the API on port 3001. Confirm the API is reachable at `/api/health`; it returns JSON with `ok: true`.

There is no sign-in or registration screen. Selecting **Start my journey** creates a private guest study space automatically; progress stays with that browser/device.

In production, run the Node server so it can serve both the built frontend and `/api` routes. Static-only hosting cannot start guest journeys or save progress; configure the API and frontend behind the same origin.

```sh
npm test
npm run typecheck
npm run build
```

## PostgreSQL deployment

Production requires PostgreSQL: the server exits at startup if `NODE_ENV=production` and `DATABASE_URL` is not set. The PostgreSQL schema and seed data are initialized automatically. Build the frontend with `npm run build` before `npm start`; the Node server then serves the built app and API from one origin.

```sh
DATABASE_URL='postgres://user:password@host:5432/axiom' \
ADMIN_EMAIL='admin@example.com' \
ADMIN_PASSWORD='use-a-long-unique-password' \
NODE_ENV=production npm start
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are optional; when both are set and the password is at least 12 characters, startup provisions that account with administrator access. Configure TLS as required by your PostgreSQL provider in the connection string/environment. Keep database credentials and admin secrets out of source control.

SQLite is intended for local development and automated tests. PostgreSQL is the required production database.

## What is implemented

- One-click anonymous guest onboarding with a persistent HTTP-only browser session, profile settings, and independent competition enrollment/progress. No login is needed to start.
- AMC 10 journey with Number Theory, Algebra, Geometry, and Combinatorics; structured lessons, prerequisites, mastery gates, and interactive answer types.
- Server-validated original practice questions, progressive hints, explanations after a correct answer or an additional attempt, spaced review scheduling, timed sets, mini assessments, and persisted session resume.
- XP, levels, achievements, daily quests, streaks, activity history, topic mastery estimates, and opt-in leaderboard data.
- A context-aware study tutor that responds with progressive hints and study recommendations. It is heuristic/adaptive application behavior; no external AI service or model API is called.
- Administrator content studio for competitions, syllabi, lessons, prerequisite graphs, questions, rubrics, proof-review queue, and assessment blueprints. New content is created unpublished and changes are audit-logged.

For rubric-based proof questions, student work is stored as pending and never auto-graded or shown a hidden answer key. An administrator must accept it or request revision with feedback before it affects mastery or earns first-solve XP.
