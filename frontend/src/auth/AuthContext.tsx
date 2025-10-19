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
  loading: boolean;
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
    const stored = localStorage.getItem('userType');
    return stored as UserType | null;
  });
  const [loading, setLoading] = useState<boolean>(!!token);

  async function fetchUserData(authToken: string) {
    console.log('🔐 Fetching user data with token...');
    setLoading(true);
    
    try {
      // First, try to extract userType from JWT token as backup
      let tokenUserType: UserType | null = null;
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        console.log('🎫 JWT payload:', payload);
        tokenUserType = payload.userType;
      } catch (err) {
        console.warn('⚠️ Could not decode JWT:', err);
      }
      
      const me = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (me.ok) {
        const userData = await me.json();
        
        // If backend returns null userType, use the one from JWT token
        if (!userData.userType && tokenUserType) {
          userData.userType = tokenUserType;
        }
        
        // If we still don't have userType, something is very wrong
        if (!userData.userType) {
          console.error('❌ No userType available from backend or token!');
          // Try localStorage as last resort
          const storedUserType = localStorage.getItem('userType') as UserType;
          if (storedUserType) {
            console.log('🔄 Using stored userType:', storedUserType);
            userData.userType = storedUserType;
          } else {
            
            logout();
            return;
          }
        }
        
        setUser(userData);
        setUserType(userData.userType);
        localStorage.setItem('userType', userData.userType);
      } else {
        logout();
      }
    } catch (err) {
      logout();
    } finally {
      console.log('🏁 Auth loading complete');
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
    // Clear any existing auth data first
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    setToken(null);
    setUser(null);
    setUserType(null);
    
    const data = await api<{ access_token: string; userType: UserType }>(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userType', data.userType);
    setToken(data.access_token);
    setUserType(data.userType);
  }

  async function register(email: string, password: string, userType: UserType) {
    console.log('📝 Registering:', email, 'as', userType);
    
    // Clear any existing auth data first
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    setToken(null);
    setUser(null);
    setUserType(null);
    
    const data = await api<{ access_token: string; userType: UserType }>(`/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email, password, userType }),
    });
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userType', data.userType);
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
    localStorage.removeItem('userType');
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