import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import LoginForm from '../components/LoginForm';
import './style/Loginstyle.css'; 

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login, register, token } = useAuth();

  useEffect(() => {
    if (token) nav('/');
  }, [token, nav]);

  async function onSubmit(email: string, password: string) {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      let msg = 'Something went wrong';
      try {
        if (err?.json) {
          const data = await err.json();
          msg = Array.isArray(data?.message) ? data.message[0] : (data?.message || msg);
        } else if (err?.response?.json) {
          const data = await err.response.json();
          msg = Array.isArray(data?.message) ? data.message[0] : (data?.message || msg);
        } else if (typeof err?.message === 'string') {
          msg = err.message;
        }
      } catch {
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
        <LoginForm
          mode={mode}
          onSubmit={onSubmit}
          error={error ?? undefined}
          loading={loading}
        />
        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button className="link-btn" onClick={() => setMode('register')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="link-btn" onClick={() => setMode('login')}>
                Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
