import { createContext, useContext, useState } from 'react';
import { api, session } from './api.js';
import { notify, confirmDialog } from './notice.jsx';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// Saan pupunta ang bawat role pagka-login
export const HOME = { customer: '/products', admin: '/admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => session.get()?.user ?? null);

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    session.set({ token: data.token, user: data.user });
    setUser(data.user);
    return data.user;
  }
  // Pagkatapos mag-register: ang API ay nagbabalik na ng { token, user }
  function setSession(data) { session.set({ token: data.token, user: data.user }); setUser(data.user); }
  // Pagkatapos i-edit ang profile: i-sync ang pangalan sa naka-save na session
  function updateUser(patch) {
    const s = session.get(); if (!s) return;
    const next = { ...s.user, ...patch };
    session.set({ ...s, user: next }); setUser(next);
  }
  // May "Are you sure?" muna bago mag-logout
  async function logout() {
    const ok = await confirmDialog({ title: 'Log out?', message: 'Are you sure you want to log out of your account?', confirmText: 'Yes, log out', icon: 'fa-right-from-bracket' });
    if (!ok) return false;
    session.clear(); setUser(null); notify('You have been logged out.');
    return true;
  }

  return <Ctx.Provider value={{ user, login, setSession, updateUser, logout }}>{children}</Ctx.Provider>;
}
