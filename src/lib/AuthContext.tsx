import React, { createContext, useContext, useState, useEffect } from 'react';

type User = { id: string; name: string; email: string };

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, []);

  const login = (u: User, t: string, rt?: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('token', t);
    if (rt) localStorage.setItem('refresh_token', rt);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
  };

  const refreshSession = async (): Promise<string | null> => {
    const rt = localStorage.getItem('refresh_token');
    if (!rt) { logout(); return null; }

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      if (!res.ok) { logout(); return null; }
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('token', data.token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      return data.token;
    } catch {
      logout();
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
