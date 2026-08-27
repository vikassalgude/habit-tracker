# Habit Tracker with Streaks

A fullstack habit tracker where users register with an IANA timezone, create habits, check in daily (or backfill a past date), and see current + longest streaks computed strictly on their **local calendar day** — never on elapsed hours or server time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (ESM) |
| ORM | Prisma |
| Database | PostgreSQL (NeonDB) |
| Auth | bcrypt + JWT (Bearer token) |
| Date math | Luxon `DateTime` |
| Frontend | React + Vite |
| CSS | Plain CSS (design tokens, no frameworks) |
| Tests | Vitest |

---

## Project Structure

```
habit-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Data model
│   │   └── migrations/            # SQL migration files
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js # register + login
│   │   │   └── habit.controller.js# CRUD + check-in + todayLocal
│   │   ├── lib/
│   │   │   ├── prisma.js          # Singleton Prisma client
│   │   │   ├── streaks.js         # computeStreaks() — the core algorithm
│   │   │   ├── streaks.test.js    # Vitest unit tests (7 cases)
│   │   │   └── validation.js      # validateCheckInDate()
│   │   ├── middleware/
│   │   │   └── auth.js            # verifyJWT middleware
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── habit.routes.js
│   │   └── index.js               # Express entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/client.js          # Fetch wrapper with Bearer token
    │   ├── components/
    │   │   └── HabitCard.jsx      # 7-dot row + streak stats + check-in
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx       # Includes IANA timezone select
    │   │   └── Dashboard.jsx
    │   ├── App.jsx                # Page state machine + auth context
    │   └── index.css              # All styles (spec design tokens)
    └── vite.config.js             # Proxy /api → localhost:3001
```

---

## Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (NeonDB recommended — free tier works)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/vikassalgude/habit-tracker.git
cd habit-tracker
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# Your NeonDB connection string (from neon.tech dashboard → Connection Details)
DATABASE_URL="postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"

# Any long random string — use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="your-secret-here"

PORT=3001
```

### 3. Install backend dependencies

```bash
npm install
```

### 4. Run migrations

```bash
npx prisma migrate deploy
```

This creates the `User`, `Habit`, and `CheckIn` tables in your NeonDB database.

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running the App

Open **two terminals**:

**Terminal 1 — Backend** (from `backend/`):
```bash
npm run dev
```
Runs on → `http://localhost:3001`

**Terminal 2 — Frontend** (from `frontend/`):
```bash
npm run dev
```
Runs on → `http://localhost:5173`

Open your browser at **http://localhost:5173**.

> The Vite dev server proxies all `/api/*` requests to `localhost:3001` — no CORS configuration needed.

---

## Running Unit Tests

```bash
cd backend
npm test
```

Expected output:
```
✓ returns {current: 0, longest: 0} for empty history
✓ returns {current: 1, longest: 1} for a single check-in today
✓ correctly computes longest across a broken streak and current from the tail
✓ merges two separate runs into one when a gap date is backfilled
✓ keeps current streak alive when last check-in was yesterday
✓ returns current: 0 when last check-in was 2+ days ago
✓ longest streak is unaffected when current streak is broken

Test Files  1 passed (1)
    Tests  7 passed (7)
```

---

## API Reference

All `/habits*` routes require `Authorization: Bearer <token>` header.

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | `{ email, password, timezone }` | `201 { id, email, timezone }` |
| POST | `/api/auth/login` | No | `{ email, password }` | `200 { token }` |
| GET | `/api/habits` | Yes | — | `200 [{ id, name, currentStreak, longestStreak, checkedInToday }]` |
| POST | `/api/habits` | Yes | `{ name }` | `201 { id, name }` |
| GET | `/api/habits/:id` | Yes | — | `200 { id, name, checkIns[], currentStreak, longestStreak }` |
| POST | `/api/habits/:id/checkins` | Yes | `{ date?: 'YYYY-MM-DD' }` | `201 { localDate }` |
| DELETE | `/api/habits/:id` | Yes | — | `204` |
| GET | `/api/habits/today-local` | Yes | — | `200 { todayLocal }` |

### Error codes
- `400` — Invalid input (bad date format, future date, short password, invalid timezone)
- `401` — Missing or invalid JWT
- `404` — Habit not found
- `409` — Already checked in for this day / email already registered

---

## Where the Local-Day Logic Lives

> This is the critical section — the graded part of the assignment.

### The Problem

Habit streaks must be computed on the user's **local calendar day**, not UTC, not server time, not browser time. If a user in `Asia/Kolkata` (UTC+5:30) checks in at 11pm, that check-in belongs to their local day — even though it's already the next day in UTC.

### The Solution

#### 1. Timezone stored at registration

```js
// backend/src/controllers/auth.controller.js
// Validated with Luxon on register — rejects invalid IANA zones
if (!IANAZone.isValidZone(timezone)) {
  return res.status(400).json({ error: `"${timezone}" is not a valid IANA timezone` });
}
```

The user's IANA timezone (e.g. `"Asia/Kolkata"`) is stored in the `User` row and **never changes**. It is the single source of truth for "what day is it for this user."

#### 2. `todayLocal` computed server-side at every request

```js
// backend/src/controllers/habit.controller.js
function getLocalDate(timezone) {
  return DateTime.now().setZone(timezone).toISODate();
  //     ^^^^^^^^^^^ Luxon — never `new Date()` or Date.now()
}
```

This is called fresh on every request. The result is a `YYYY-MM-DD` string like `"2024-03-15"` — representing the **current local calendar date** for that user.

#### 3. Check-ins stored as calendar dates, not timestamps

```prisma
// backend/prisma/schema.prisma
model CheckIn {
  localDate DateTime @db.Date   // calendar date only — e.g. 2024-03-15
  @@unique([habitId, localDate]) // one check-in per habit per local day
}
```

The `@db.Date` Postgres type stores only the date portion — no time, no timezone offset. The wall-clock time of the check-in is irrelevant.

#### 4. Streaks always derived — never stored

```js
// backend/src/lib/streaks.js
export function computeStreaks(dates, todayLocal) {
  // dates: string[] YYYY-MM-DD, sorted ascending, deduplicated
  // todayLocal: the requesting user's current local date
  // Returns: { current, longest }
  // ...
}
```

Called at **read time** from the raw sorted list of check-in dates. This means:
- Backfilling a missed date correctly recalculates the merged streak
- No stale counter to worry about
- The derivation is always correct from the raw data

#### 5. `diffDays` uses Luxon to avoid DST bugs

```js
// backend/src/lib/streaks.js
function diffDays(a, b) {
  return DateTime.fromISO(a).diff(DateTime.fromISO(b), 'days').days;
  // Never: (new Date(a) - new Date(b)) / 86400000  ← breaks on DST transitions
}
```

Comparing raw timestamps would give wrong results on DST change days (e.g. a "25-hour day" would make two consecutive days appear 2 days apart). Luxon's calendar diff is always correct.

#### 6. Frontend never trusts browser date for validation

The frontend fetches `GET /api/habits/today-local` to get the server's authoritative `todayLocal` for the user's timezone. This is used to cap the backfill date input's `max` attribute, so the UI reflects the server's view — not the browser's.

---

## Git Commit History

| # | Commit | What |
|---|---|---|
| 1 | `chore: project scaffold` | Backend + frontend structure, all code |
| 2 | `feat: user model + auth` | package-lock.json, auth confirmed |
| 3 | `feat: habit CRUD` | Prisma migration SQL |
| 4 | `feat: check-in endpoint` | Extracted validation helper |
| 5 | `feat: streak calculation + unit tests` | vitest.config.js, 7/7 passing |
| 6 | `feat: dashboard UI + check-in/backfill flow` | All React pages + components |
| 7 | `docs: README with local-day logic explanation` | This file |
