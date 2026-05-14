import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

type User = { id: string; name: string; email: string };

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  authedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      tokenRef.current = storedToken;
    }
  }, []);

  const login = (u: User, t: string) => {
    setUser(u);
    setToken(t);
    tokenRef.current = t;
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('token', t);
  };

  const logout = useCallback(() => {
    const currentToken = tokenRef.current;
    setUser(null);
    setToken(null);
    tokenRef.current = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    if (currentToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {});
    }
  }, []);

  const authedFetch = useCallback(async (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`);
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401) {
      logout();
      window.location.href = '/login';
    }
    return res;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authedFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
