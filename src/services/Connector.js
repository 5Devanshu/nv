import axios        from 'axios';
import { store }    from '../app/store';
import { clearCredentials } from '../app/authSlice';

const Connector = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT ──────────────────────────
Connector.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — handle 401 ────────────────────────
Connector.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      store.dispatch(clearCredentials());
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default Connector;