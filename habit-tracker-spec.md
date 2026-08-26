# Habit Tracker with Streaks — Build Spec

## Objective
A fullstack habit tracker. Users register with an assigned IANA timezone, create habits,
check in daily (or backfill a past date), and see current + longest streaks computed
strictly on their **local calendar day** — never on elapsed hours or server time.

## Tech Stack
- Backend: Node.js + Express, Prisma ORM, PostgreSQL
- Frontend: React (Vite), plain CSS or Tailwind — keep it simple
- Auth: email + password, bcrypt hashing, JWT (httpOnly cookie or bearer — pick one and document it)
- Date/timezone math: Luxon (`DateTime`) — do not hand-roll timezone arithmetic
- Testing: Vitest or Jest for the streak-calculation function specifically

## Non-Goals (explicitly do NOT build these)
- OAuth/social login, password reset flow
- Habit categories, tags, reminders, notifications
- Streak freezes/pauses/vacations
- Multi-user habit sharing
- Any UI polish beyond clean and functional

## Data Model (Prisma)
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  timezone     String   // IANA tz, e.g. "Asia/Kolkata" — assigned at registration
  createdAt    DateTime @default(now())
  habits       Habit[]
}

model Habit {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  name      String
  createdAt DateTime  @default(now())
  checkIns  CheckIn[]
}

model CheckIn {
  id        String   @id @default(cuid())
  habitId   String
  habit     Habit    @relation(fields: [habitId], references: [id])
  localDate DateTime @db.Date   // calendar date only, NOT a timestamp
  createdAt DateTime @default(now())

  @@unique([habitId, localDate])
}
```

## THE CORE RULE — local-day logic (this is what's being graded)
1. A user's IANA timezone is fixed at registration and stored on their row. It — not the
   request's IP, not the browser's `Intl` timezone — is the single source of truth for
   "what day is it" for that user.
2. `todayLocal` is computed **server-side, at request time**:
   `DateTime.now().setZone(user.timezone).toISODate()`. Never use a bare `new Date()`.
3. Check-ins are stored as a plain calendar date (`YYYY-MM-DD`), not a timestamp. The
   wall-clock time of the check-in is irrelevant — only which local day it represents.
4. Do NOT persist a mutable streak counter that increments on insert. Backfilling a
   missed day in the middle of an existing streak breaks that approach. Always **derive**
   current/longest streak from the full sorted, deduplicated list of a habit's check-in
   dates, computed at read time (cache + invalidate on write if you want, but the
   derivation must be correct from the raw dates).

### Streak algorithm (implement exactly this, then unit test it)
```js
// dates: string[] of YYYY-MM-DD, sorted ascending, deduplicated
// todayLocal: string YYYY-MM-DD for the requesting user
function computeStreaks(dates, todayLocal) {
  if (dates.length === 0) return { current: 0, longest: 0 };

  let longest = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = diffDays(dates[i], dates[i - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const gap = diffDays(todayLocal, dates[dates.length - 1]);
  let current = 0;
  if (gap === 0 || gap === 1) { // checked in today, or yesterday (today isn't over yet)
    current = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      if (diffDays(dates[i], dates[i - 1]) === 1) current++; else break;
    }
  }
  return { current, longest };
}
// diffDays must diff CALENDAR days (Luxon: DateTime.fromISO(a).diff(DateTime.fromISO(b), 'days').days)
// never diff raw Date instants — that's where DST bugs come from.
```

### Unit tests to include (minimum)
- empty history → `{current: 0, longest: 0}`
- single check-in today → `{current: 1, longest: 1}`
- broken streak (gap in middle) → longest correctly spans the best run, current reflects only the tail
- backfill that fills a gap between two existing runs → they merge into one longer run
- last check-in was yesterday, not today yet → current streak still alive
- last check-in was 2+ days ago → current streak is 0, longest unaffected

## Validation Rules
- Check-in date > `todayLocal` → `400` `"Cannot log a future date"`
- Duplicate `(habitId, localDate)` → `409` `"Already checked in for this day"`
  (let the DB `@@unique` constraint enforce it; catch Prisma `P2002` and translate the response)
- Registration timezone must be a real IANA zone — validate with Luxon `IANAZone.isValidZone(tz)`
- Passwords: bcrypt hashed, minimum 8 chars, never returned or logged

## API Contract
```
POST   /api/auth/register   { email, password, timezone }         -> 201 { id, email, timezone }
POST   /api/auth/login      { email, password }                   -> 200 { token }
GET    /api/habits                                                -> 200 [{ id, name, currentStreak, longestStreak, checkedInToday }]
POST   /api/habits          { name }                               -> 201 { id, name }
GET    /api/habits/:id                                            -> 200 { id, name, checkIns[], currentStreak, longestStreak }
POST   /api/habits/:id/checkins  { date?: 'YYYY-MM-DD' }           -> 201 { localDate }   // omitted date = todayLocal
DELETE /api/habits/:id                                             -> 204   // optional, nice-to-have
```
All `/habits*` routes require auth middleware that verifies the JWT and attaches `req.user`.

## Frontend Requirements
- Login / register pages (register includes a timezone select, default to browser-detected IANA zone but let it be overridden)
- Dashboard: each habit shows current + longest streak, a "Check in today" button that
  reflects already-checked-in state, and a date picker for backfilling capped at the
  server's `todayLocal` (fetch this from the API — don't trust the browser's local date
  for validation, only as a UI default)
- Inline error display for 400/409 responses

## Frontend Design Direction
Keep this simple and quiet — one deliberate idea, not a generic admin-dashboard template.
Do not use Bootstrap/Material defaults, gradients, drop shadows, glassmorphism, or a
generic blue-and-white SaaS look.

**Tokens**
- Background: `#F3F5F1` (pale sage-tinted off-white)
- Ink/text: `#1F2A22` (deep forest-black)
- Border/hairline: `#DCE3DA`, 1px, no shadows
- Accent (primary / checked-in state): `#4B7A51` (moss green)
- Accent (current-streak highlight only, used sparingly): `#C98A3D` (muted amber)
- Error: `#B24C3C` (muted brick red)
- Numbers/dates face: a monospace font (`JetBrains Mono` or `IBM Plex Mono`) for every
  streak count and date — gives them a tally-counter feel rather than a generic stat card
- UI/body face: a clean humanist sans (`Inter` or `Public Sans`) for labels, nav, buttons

**Layout**
- Minimal top bar: lowercase wordmark ("habits"), the user's email, logout — nothing else
- One card per habit (not a dense grid):
  - habit name
  - a row of 7 small dots for the last 7 local days — filled for a check-in, hollow
    outline for a miss. This is the signature element: it makes a streak's rhythm
    visible at a glance instead of being just a number.
  - current streak + longest streak in the mono face, small muted labels above each
  - "check in today" button, or a quiet checked-in state if already done
  - an unobtrusive backfill control (a plain date input, not a modal)
- Generous whitespace, 8-10px border radius, nothing pill-shaped except the check-in
  button itself
- Responsive to a single column below ~640px
- No emoji; a small check icon for "checked in" is the only decoration allowed

**Non-negotiable:** this assignment is graded on the backend logic, not the UI — build
the design above once, cleanly, and don't spend disproportionate time polishing it.

## Deliverables Checklist
- [ ] Prisma schema + migration committed
- [ ] `.env.example` with `DATABASE_URL`, `JWT_SECRET`
- [ ] README: setup steps, how to run migrations, and a section explicitly explaining
      where the local-day logic lives (this doubles as your video script)
- [ ] Unit tests for `computeStreaks` (see list above)
- [ ] Meaningful, incremental git commits — not one giant commit

## Suggested Commit Sequence
1. `chore: project scaffold (backend + frontend, prisma init)`
2. `feat: user model + auth (register/login, bcrypt, JWT)`
3. `feat: habit CRUD`
4. `feat: check-in endpoint with future-date and duplicate-day validation`
5. `feat: streak calculation + unit tests`
6. `feat: dashboard UI + check-in/backfill flow`
7. `docs: README with local-day logic explanation`
