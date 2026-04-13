import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if the user has a valid session
  useEffect(() => {
    authApi.me()
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    // POST /auth/login returns the user object directly (not wrapped)
    const user = data.user || data;
    setUser(user);
    return user;
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const data = await authApi.googleLogin(credential);
    const user = data.user || data;
    setUser(user);
    return user;
  }, []);

  const otpLogin = useCallback(async ({ phone, code, channel, displayName, email }) => {
    const data = await authApi.verifyOtp({ phone, code, channel, displayName, email });
    const user = data.user || data;
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ok */ }
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isAuthor = user?.role === 'admin' || user?.role === 'author';

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, otpLogin, logout, isAdmin, isAuthor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
