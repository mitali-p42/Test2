import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

type UserType = 'candidate' | 'recruiter';

type Me = {
  id: string;
  email: string;
  createdAt: string;
  userType: UserType;
  role: string | '—';
  interviewType: string | '—';
  yearsOfExperience: number | string | '—';
  skills?: string[];
  totalQuestions?: number;
  companyName?: string | null;
  hasProfile: boolean;
};

type AuthContextType = {
  token: string | null;
  user: Me | null;
  userType: UserType | null;
  loading: boolean; // Add loading state
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userType: UserType) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<Me | null>(null);
  const [userType, setUserType] = useState<UserType | null>(() => {
    // Try to get userType from localStorage on initial load
    return (localStorage.getItem('userType') as UserType) || null;
  });
  const [loading, setLoading] = useState<boolean>(!!token); // Add loading state

  async function fetchUserData(authToken: string) {
    setLoading(true);
    try {
      const me = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (me.ok) {
        const userData = await me.json();
        setUser(userData);
        setUserType(userData.userType);
        localStorage.setItem('userType', userData.userType); // Store userType in localStorage
      } else {
        logout();
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      logout();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      fetchUserData(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  async function login(email: string, password: string) {
    const data = await api<{ access_token: string; userType: UserType }>(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userType', data.userType); // Store userType
    setToken(data.access_token);
    setUserType(data.userType);
  }

  async function register(email: string, password: string, userType: UserType) {
    const data = await api<{ access_token: string; userType: UserType }>(`/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email, password, userType }),
    });
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userType', data.userType); // Store userType
    setToken(data.access_token);
    setUserType(data.userType);
  }

  async function refreshUser() {
    if (token) {
      await fetchUserData(token);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType'); // Remove userType from localStorage
    setToken(null);
    setUser(null);
    setUserType(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, userType, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}