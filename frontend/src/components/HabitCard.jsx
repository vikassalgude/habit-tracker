import { useState } from 'react';
import { habitApi } from '../api/client.js';

// ─── Check Icon (SVG) ────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2 7L5.5 10.5L11 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── 7-Dot Row ───────────────────────────────────────────────────────────────
function DotRow({ checkIns, todayLocal }) {
  // Build last 7 local days from todayLocal (which comes from the server via habit data)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayLocal + 'T00:00:00');
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push(iso);
  }

  return (
    <div className="dot-row" title="Last 7 days">
      {days.map((day) => {
        const filled = checkIns.includes(day);
        const isToday = day === todayLocal;
        return (
          <span
            key={day}
            className={`dot${filled ? ' filled' : ''}${isToday && !filled ? ' today' : ''}`}
            title={day}
          />
        );
      })}
    </div>
  );
}

// ─── Habit Card ───────────────────────────────────────────────────────────────
export default function HabitCard({ habit, todayLocal, onUpdated }) {
  const [backfillDate, setBackfillDate] = useState('');
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkInToday() {
    if (loading) return;
    setCardError('');
    setLoading(true);
    try {
      await habitApi.checkIn(habit.id);
      onUpdated();
    } catch (err) {
      setCardError(err.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleBackfill(e) {
    e.preventDefault();
    if (!backfillDate || loading) return;
    setCardError('');
    setLoading(true);
    try {
      await habitApi.checkIn(habit.id, backfillDate);
      setBackfillDate('');
      onUpdated();
    } catch (err) {
      setCardError(err.message || 'Backfill failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${habit.name}"? This cannot be undone.`)) return;
    try {
      await habitApi.delete(habit.id);
      onUpdated();
    } catch {
      setCardError('Delete failed');
    }
  }

  return (
    <div className="habit-card">
      {/* Top row: name + delete */}
      <div className="habit-card-top">
        <span className="habit-name">{habit.name}</span>
        <button
          id={`btn-delete-${habit.id}`}
          className="btn-delete"
          onClick={handleDelete}
          title="Delete habit"
          aria-label={`Delete ${habit.name}`}
        >
          delete
        </button>
      </div>

      {/* 7-dot row — signature element */}
      <DotRow checkIns={habit.checkIns || []} todayLocal={todayLocal} />

      {/* Streak stats */}
      <div className="streak-stats">
        <div className="streak-stat">
          <span className="streak-label">current</span>
          <span className="streak-value current">{habit.currentStreak}</span>
        </div>
        <div className="streak-stat">
          <span className="streak-label">longest</span>
          <span className="streak-value">{habit.longestStreak}</span>
        </div>
      </div>

      {/* Bottom row: check-in button + backfill */}
      <div className="habit-card-bottom">
        {habit.checkedInToday ? (
          <div className="btn-checked" aria-label="Already checked in today">
            <CheckIcon /> checked in
          </div>
        ) : (
          <button
            id={`btn-checkin-${habit.id}`}
            className="btn-checkin"
            onClick={checkInToday}
            disabled={loading}
          >
            {loading ? '…' : 'check in today'}
          </button>
        )}

        {/* Backfill control */}
        <form className="backfill-row" onSubmit={handleBackfill}>
          <label className="backfill-label" htmlFor={`backfill-${habit.id}`}>
            backfill
          </label>
          <input
            id={`backfill-${habit.id}`}
            className="backfill-input"
            type="date"
            value={backfillDate}
            max={todayLocal}
            onChange={(e) => { setBackfillDate(e.target.value); setCardError(''); }}
          />
          <button
            className="backfill-btn"
            type="submit"
            disabled={!backfillDate || loading}
          >
            log
          </button>
        </form>
      </div>

      {cardError && (
        <p className="card-error" role="alert">{cardError}</p>
      )}
    </div>
  );
}
