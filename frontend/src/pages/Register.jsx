import { useState } from 'react';
import { authApi } from '../api/client.js';

// Get a list of common IANA timezones for the select
const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : [
      'Africa/Cairo', 'America/Chicago', 'America/Los_Angeles', 'America/New_York',
      'America/Sao_Paulo', 'Asia/Bangkok', 'Asia/Dubai', 'Asia/Jakarta',
      'Asia/Kolkata', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore',
      'Asia/Tokyo', 'Australia/Sydney', 'Europe/Berlin', 'Europe/London',
      'Europe/Moscow', 'Europe/Paris', 'Pacific/Auckland', 'UTC',
    ];

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function Register({ onSwitch, onLogin }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    timezone: TIMEZONES.includes(browserTz) ? browserTz : 'UTC',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(form);
      // Auto-login after register
      const { token } = await authApi.login({ email: form.email, password: form.password });
      onLogin(token, form.email);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">create account</h1>
        <p className="auth-subtitle">
          already have one?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitch(); }}>sign in</a>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">email</label>
            <input
              id="reg-email"
              className={`form-input${error ? ' error' : ''}`}
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">password</label>
            <input
              id="reg-password"
              className={`form-input${error ? ' error' : ''}`}
              type="password"
              name="password"
              placeholder="min 8 characters"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-timezone">timezone</label>
            <select
              id="reg-timezone"
              className="form-select"
              name="timezone"
              value={form.timezone}
              onChange={handleChange}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>
              This determines your local day for streaks — choose carefully.
            </p>
          </div>

          {error && <div className="inline-error" role="alert">{error}</div>}

          <button
            id="btn-register-submit"
            className="btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'creating account…' : 'create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
