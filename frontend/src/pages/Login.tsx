//Login.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import LoginForm from '../components/LoginForm';
import './style/Loginstyle.css';

type UserType = 'candidate' | 'recruiter';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userType, setUserType] = useState<UserType>('candidate');
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
        await register(email, password, userType);
      }
    } catch (err: any) {
      let msg = 'Something went wrong';
      
      // Handle error message extraction
      if (err?.message) {
        msg = err.message;
      } else if (err?.json) {
        try {
          const data = await err.json();
          msg = Array.isArray(data?.message) ? data.message[0] : (data?.message || msg);
        } catch {}
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        
        {mode === 'register' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              fontWeight: 600, 
              fontSize: 14,
              color: '#374151',
            }}>
              I am a:
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ 
                flex: 1, 
                padding: 12, 
                border: `2px solid ${userType === 'candidate' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
                background: userType === 'candidate' ? '#eff6ff' : 'white',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}>
                <input
                  type="radio"
                  name="userType"
                  value="candidate"
                  checked={userType === 'candidate'}
                  onChange={(e) => setUserType(e.target.value as UserType)}
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 500 }}>👤 Candidate</span>
              </label>
              
              <label style={{ 
                flex: 1, 
                padding: 12, 
                border: `2px solid ${userType === 'recruiter' ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
                background: userType === 'recruiter' ? '#eff6ff' : 'white',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}>
                <input
                  type="radio"
                  name="userType"
                  value="recruiter"
                  checked={userType === 'recruiter'}
                  onChange={(e) => setUserType(e.target.value as UserType)}
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 500 }}>💼 Recruiter</span>
              </label>
            </div>
          </div>
        )}

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
              <button 
                className="link-btn" 
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button 
                className="link-btn" 
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}