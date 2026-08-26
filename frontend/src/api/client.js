const BASE = '/api';

function getToken() {
  return localStorage.getItem('ht_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw { status: res.status, message: data?.error || 'Request failed' };
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
};

// ─── Habits ───────────────────────────────────────────────────────────────────
export const habitApi = {
  getAll: () => request('/habits'),
  getOne: (id) => request(`/habits/${id}`),
  create: (body) => request('/habits', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id) => fetch(`${BASE}/habits/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  }),
  checkIn: (id, date) => request(`/habits/${id}/checkins`, {
    method: 'POST',
    body: JSON.stringify(date ? { date } : {}),
  }),
};
