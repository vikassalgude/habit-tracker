import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from './api/client.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import './index.css';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);        // { email } once logged in
  const [page, setPage] = useState('login');     // 'login' | 'register' | 'dashboard'
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('ht_token');
    const email = localStorage.getItem('ht_email');
    if (token && email) {
      setUser({ email });
      setPage('dashboard');
    }
    setLoading(false);
  }, []);

  function handleLogin(token, email) {
    localStorage.setItem('ht_token', token);
    localStorage.setItem('ht_email', email);
    setUser({ email });
    setPage('dashboard');
  }

  function handleLogout() {
    localStorage.removeItem('ht_token');
    localStorage.removeItem('ht_email');
    setUser(null);
    setPage('login');
  }

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, handleLogin, handleLogout }}>
      {page === 'dashboard' && user
        ? <Dashboard onLogout={handleLogout} />
        : page === 'register'
          ? <Register onSwitch={() => setPage('login')} onLogin={handleLogin} />
          : <Login onSwitch={() => setPage('register')} onLogin={handleLogin} />
      }
    </AuthContext.Provider>
  );
}
