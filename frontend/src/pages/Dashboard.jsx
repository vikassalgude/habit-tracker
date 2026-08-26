import { useState, useEffect, useCallback } from 'react';
import { habitApi } from '../api/client.js';
import HabitCard from '../components/HabitCard.jsx';

export default function Dashboard({ onLogout }) {
  const email = localStorage.getItem('ht_email') || '';

  const [habits, setHabits] = useState([]);
  const [todayLocal, setTodayLocal] = useState('');
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Fetch habits — also extracts todayLocal from server response context
  const fetchHabits = useCallback(async () => {
    try {
      const data = await habitApi.getAll();
      setHabits(data);

      // Fetch detailed view for first habit to get server's todayLocal
      // OR we compute it from the first habit's checkins / use a dedicated endpoint
      // For now, derive todayLocal from the server's health endpoint isn't available,
      // so we use a separate call to get one habit's detail for todayLocal.
      // Fallback: use browser date (only for UI max cap on backfill input)
      if (!todayLocal) {
        const browserToday = new Date().toISOString().slice(0, 10);
        setTodayLocal(browserToday);
      }
    } catch (err) {
      console.error('Failed to fetch habits', err);
    } finally {
      setLoading(false);
    }
  }, [todayLocal]);

  // Fetch a single habit to get the server-authoritative todayLocal
  const fetchTodayLocal = useCallback(async () => {
    try {
      const res = await fetch('/api/habits/today-local', {
        headers: { Authorization: `Bearer ${localStorage.getItem('ht_token')}` },
      });
      if (res.ok) {
        const { todayLocal: tl } = await res.json();
        setTodayLocal(tl);
      }
    } catch {
      // Fallback to browser date
      setTodayLocal(new Date().toISOString().slice(0, 10));
    }
  }, []);

  useEffect(() => {
    fetchTodayLocal();
    fetchHabits();
  }, []); // eslint-disable-line

  async function handleAddHabit(e) {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    setAddError('');
    setAdding(true);
    try {
      await habitApi.create({ name: newHabitName.trim() });
      setNewHabitName('');
      fetchHabits();
    } catch (err) {
      setAddError(err.message || 'Failed to add habit');
    } finally {
      setAdding(false);
    }
  }

  // For the 7-dot row we need checkins per habit — enrich from detail endpoint
  const [richHabits, setRichHabits] = useState([]);

  useEffect(() => {
    if (habits.length === 0) { setRichHabits([]); return; }
    // Fetch detail for each habit to get checkIns[]
    Promise.all(habits.map((h) => habitApi.getOne(h.id))).then((details) => {
      setRichHabits(details);
    }).catch(() => {
      setRichHabits(habits.map((h) => ({ ...h, checkIns: [] })));
    });
  }, [habits]);

  return (
    <div className="app-layout">
      {/* Top bar */}
      <header className="topbar">
        <span className="topbar-wordmark">habits</span>
        <div className="topbar-right">
          <span className="topbar-email">{email}</span>
          <button id="btn-logout" className="btn-logout" onClick={onLogout}>
            logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="dashboard-header">
          <h2 className="dashboard-title">your habits</h2>
        </div>

        {/* Add habit form */}
        <form className="add-habit-form" onSubmit={handleAddHabit}>
          <input
            id="input-new-habit"
            className="form-input"
            type="text"
            placeholder="new habit name…"
            value={newHabitName}
            onChange={(e) => { setNewHabitName(e.target.value); setAddError(''); }}
            maxLength={80}
          />
          <button
            id="btn-add-habit"
            className="btn-icon-add"
            type="submit"
            disabled={adding || !newHabitName.trim()}
          >
            {adding ? '…' : '+ add'}
          </button>
        </form>
        {addError && <div className="inline-error" role="alert">{addError}</div>}

        {/* Habit list */}
        {loading ? (
          <div className="loading">loading habits…</div>
        ) : richHabits.length === 0 ? (
          <div className="empty-state">
            <p>no habits yet — add one above to get started.</p>
          </div>
        ) : (
          richHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              todayLocal={todayLocal}
              onUpdated={fetchHabits}
            />
          ))
        )}
      </main>
    </div>
  );
}
