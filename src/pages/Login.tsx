import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useAuth } from '@/src/lib/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, user } = useAuth();

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleDemoLogin = async () => {
    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@example.com', password: 'demo1234' })
      });
      let data = await res.json();

      if (!res.ok) {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Demo User', email: 'demo@example.com', password: 'demo1234' })
        });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.error);
      login(data.user, data.token, data.refresh_token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.user, data.token, data.refresh_token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-4 font-sans">
      <Card className="w-full max-w-md shadow-lg border-2 border-green-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-green-600"></div>
        <CardHeader className="pt-8 pb-4 text-center border-b-0 space-y-2">
          <div className="mx-auto w-12 h-12 bg-green-700 text-white rounded flex items-center justify-center font-bold text-lg mb-2 shadow-inner border border-green-800">
            PR
          </div>
          <CardTitle className="text-lg font-black tracking-tight text-green-900 uppercase">Welcome Back</CardTitle>
          <p className="text-[10px] uppercase font-bold text-green-600 tracking-widest">Please enter your details to login</p>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && <div className="p-3 bg-red-50 border-2 border-red-200 text-red-700 rounded text-xs font-bold uppercase tracking-wider">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 border-green-300 font-medium" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 border-green-300 font-medium tracking-widest" />
            </div>
            <Button type="submit" className="w-full h-12 text-sm shadow-sm pt-3">LOGIN</Button>
            <Button type="button" onClick={handleDemoLogin} variant="secondary" className="w-full h-12 text-sm shadow-sm pt-3 mt-4">DEMO LOGIN (NO CREDS)</Button>
          </form>
          <div className="mt-8 pt-6 border-t border-green-100 text-center text-xs font-medium text-green-700 uppercase tracking-wider">
            Don't have an account? <Link to="/register" className="font-bold text-green-900 border-b-2 border-green-700 pb-0.5 hover:text-green-700 transition">Sign up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
