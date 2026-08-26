import { DateTime } from 'luxon';
import prisma from '../lib/prisma.js';
import { computeStreaks } from '../lib/streaks.js';
import { validateCheckInDate } from '../lib/validation.js';

/**
 * Get todayLocal for the requesting user's timezone.
 * This is the single source of truth — never use new Date() or browser time.
 */
function getTodayLocal(timezone) {
  return DateTime.now().setZone(timezone).toISODate();
}

/**
 * Build streak + checkedInToday metadata for a habit's check-in dates.
 * @param {string[]} checkInDates - array of YYYY-MM-DD strings
 * @param {string}   todayLocal
 */
function buildStreakData(checkInDates, todayLocal) {
  // Ensure sorted ascending, deduplicated
  const sorted = [...new Set(checkInDates)].sort();
  const { current, longest } = computeStreaks(sorted, todayLocal);
  const checkedInToday = sorted.includes(todayLocal);
  return { currentStreak: current, longestStreak: longest, checkedInToday };
}

/**
 * Format a Prisma CheckIn's localDate (Date object) to YYYY-MM-DD string.
 */
function formatDate(date) {
  return DateTime.fromJSDate(date).toISODate();
}

// ─── GET /api/habits ─────────────────────────────────────────────────────────
export async function getHabits(req, res) {
  try {
    const todayLocal = getTodayLocal(req.user.timezone);

    const habits = await prisma.habit.findMany({
      where: { userId: req.user.id },
      include: { checkIns: { select: { localDate: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const result = habits.map((habit) => {
      const dates = habit.checkIns.map((c) => formatDate(c.localDate));
      const { currentStreak, longestStreak, checkedInToday } = buildStreakData(dates, todayLocal);
      return {
        id: habit.id,
        name: habit.name,
        currentStreak,
        longestStreak,
        checkedInToday,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/habits ────────────────────────────────────────────────────────
export async function createHabit(req, res) {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const habit = await prisma.habit.create({
      data: { name: name.trim(), userId: req.user.id },
      select: { id: true, name: true },
    });
    return res.status(201).json(habit);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/habits/:id ─────────────────────────────────────────────────────
export async function getHabit(req, res) {
  try {
    const todayLocal = getTodayLocal(req.user.timezone);

    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { checkIns: { select: { localDate: true }, orderBy: { localDate: 'asc' } } },
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const dates = habit.checkIns.map((c) => formatDate(c.localDate));
    const { currentStreak, longestStreak, checkedInToday } = buildStreakData(dates, todayLocal);

    return res.status(200).json({
      id: habit.id,
      name: habit.name,
      checkIns: dates,
      currentStreak,
      longestStreak,
      checkedInToday,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── DELETE /api/habits/:id ──────────────────────────────────────────────────
export async function deleteHabit(req, res) {
  try {
    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    await prisma.habit.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── POST /api/habits/:id/checkins ───────────────────────────────────────────
export async function createCheckIn(req, res) {
  try {
    const todayLocal = getTodayLocal(req.user.timezone);
    const date = req.body.date || todayLocal;

    // Validate date: format + no future dates
    const { valid, error: dateError } = validateCheckInDate(date, todayLocal);
    if (!valid) {
      return res.status(400).json({ error: dateError });
    }

    // Verify the habit belongs to this user
    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    // Store as a plain calendar date (Prisma @db.Date)
    const checkIn = await prisma.checkIn.create({
      data: {
        habitId: habit.id,
        localDate: new Date(date + 'T00:00:00.000Z'), // store as UTC midnight for @db.Date
      },
      select: { localDate: true },
    });

    return res.status(201).json({ localDate: formatDate(checkIn.localDate) });
  } catch (err) {
    // P2002 = unique constraint violation (habitId, localDate)
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Already checked in for this day' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
