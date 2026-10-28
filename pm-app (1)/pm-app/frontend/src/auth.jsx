import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getToken, setToken, setRoles, setStoryMatrix } from './api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Tiny in-app event hub fed by the server-sent event stream.
const listeners = new Map();
export function useLiveEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (data) => ref.current(data);
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }, [event]);
}
const emit = (event, data) => listeners.get(event)?.forEach((fn) => fn(data));

const EVENTS = ['chat.message', 'task.assigned', 'task.updated', 'scope.changed'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [online, setOnline] = useState(false);
  const [rolesVersion, setRolesVersion] = useState(0);

  const reloadRoles = useCallback(async () => {
    try {
      const [roles, sp] = await Promise.all([api('/roles'), api('/settings/story-points')]);
      setRoles(roles);
      setStoryMatrix(sp);
      setRolesVersion((v) => v + 1);
    } catch { /* ignore */ }
  }, []);
  // re-read own permissions (e.g. after editing your own role)
  const refreshUser = useCallback(async () => {
    try { setUser(await api('/auth/me')); } catch { /* ignore */ }
  }, []);

  const toast = useCallback((text, kind = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    if (!getToken()) return setReady(true);
    api('/auth/me')
      .then(async (u) => { await reloadRoles(); setUser(u); })
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  // Server-sent events: one stream per logged-in user
  useEffect(() => {
    if (!user) return;
    const es = new EventSource(`/api/events?token=${encodeURIComponent(getToken())}`);
    es.addEventListener('ready', () => setOnline(true));
    es.onerror = () => setOnline(false);
    EVENTS.forEach((ev) =>
      es.addEventListener(ev, (e) => {
        const data = JSON.parse(e.data);
        if (ev === 'task.assigned') toast(`${data.by} assigned you: ${data.task.title}`, 'task');
        emit(ev, data);
      })
    );
    return () => es.close();
  }, [user, toast]);

  const login = async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    await reloadRoles();
    setUser(user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout, toast, online, reloadRoles, refreshUser, rolesVersion }}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </AuthCtx.Provider>
  );
}
