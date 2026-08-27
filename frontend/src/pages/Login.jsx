import { useState } from 'react';
import { authApi } from '../api/client.js';

export default function Login({ onSwitch, onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
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
      const { token } = await authApi.login(form);
      onLogin(token, form.email);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">habits</h1>
        <p className="auth-subtitle">
          no account yet?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitch(); }}>register</a>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">email</label>
            <input
              id="login-email"
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
            <label className="form-label" htmlFor="login-password">password</label>
            <input
              id="login-password"
              className={`form-input${error ? ' error' : ''}`}
              type="password"
              name="password"
              placeholder="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className="inline-error" role="alert">{error}</div>}

          <button
            id="btn-login-submit"
            className="btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'signing in…' : 'sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
