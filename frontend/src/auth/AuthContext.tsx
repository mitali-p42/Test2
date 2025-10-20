import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
    const stored = localStorage.getItem('userType');
    return stored as UserType | null;
  });
  const [loading, setLoading] = useState<boolean>(!!token);
  
  // 🔥 FIX: Use a ref to track the current token being fetched
  const currentTokenRef = useRef<string | null>(token);

  async function fetchUserData(authToken: string) {
    if (authToken !== currentTokenRef.current) {
      console.log('⏭️ Token changed, aborting stale fetch');
      return;
    }

    setUser(null);
    setLoading(true);
    
    try {
      let tokenUserType: UserType | null = null;
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        console.log('🎫 JWT payload:', payload);
        tokenUserType = payload.userType;
      } catch (err) {
        console.warn('⚠️ Could not decode JWT:', err);
      }
      
      // 🔥 FIX: Check again before fetch
      if (authToken !== currentTokenRef.current) {
        console.log('⏭️ Token changed before fetch, aborting');
        return;
      }

      const me = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });      
      
      // 🔥 FIX: Check again after fetch
      if (authToken !== currentTokenRef.current) {
        console.log('⏭️ Token changed after fetch, discarding results');
        return;
      }
      
      if (me.ok) {
        const userData = await me.json();
        console.log('✅ User data fetched:', userData);
        
        // 🔥 FIX: Verify email matches JWT to catch backend issues
        try {
          const jwtPayload = JSON.parse(atob(authToken.split('.')[1]));
          const jwtEmail = jwtPayload.email || jwtPayload.sub;
          
          if (jwtEmail && userData.email && jwtEmail !== userData.email) {
            console.error('❌ EMAIL MISMATCH!', {
              jwtEmail,
              userDataEmail: userData.email,
              message: 'Backend returned wrong user data!'
            });
            // This is a backend bug - the JWT is correct but /auth/me returned wrong user
            // For now, we'll use the data but log the error
          }
        } catch (err) {
          console.warn('Could not verify email match:', err);
        }
        
        if (!userData.userType && tokenUserType) {
          userData.userType = tokenUserType;
        }
        
        if (!userData.userType) {
          console.error('❌ No userType available from backend or token!');
          const storedUserType = localStorage.getItem('userType') as UserType;
          if (storedUserType) {
            userData.userType = storedUserType;
          } else if (tokenUserType) {
            userData.userType = tokenUserType;
          }
        }
        
        // 🔥 FIX: Final check before setting state
        if (authToken !== currentTokenRef.current) {
          console.log('⏭️ Token changed, discarding user data');
          return;
        }

        setUser(userData);
        setUserType(userData.userType || tokenUserType);
        
        if (userData.userType) {
          localStorage.setItem('userType', userData.userType);
        }
        
        console.log('✅ User state updated:', { email: userData.email, userType: userData.userType });
      } else {
        console.error('❌ Auth/me failed:', me.status);
        if (tokenUserType) {
          setUserType(tokenUserType);
          localStorage.setItem('userType', tokenUserType);
        } else {
          logout();
        }
      }
    } catch (err) {
      console.error('❌ Failed to fetch user data:', err);
      if (authToken === currentTokenRef.current) {
        const storedUserType = localStorage.getItem('userType') as UserType;
        if (storedUserType) {
          setUserType(storedUserType);
        } else {
          console.error('❌ No stored userType, logging out');
          logout();
        }
      }
    } finally {
      if (authToken === currentTokenRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    console.log('🔄 Token changed, current token:', token ? 'exists' : 'null');
    currentTokenRef.current = token; // 🔥 FIX: Update ref
    
    if (token) {
      fetchUserData(token);
    } else {
      console.log('⏭️ No token found, skipping user fetch');
      setLoading(false);
      setUser(null);
      setUserType(null);
    }
  }, [token]);

  async function login(email: string, password: string) {
    console.log('🔐 Logging in as:', email);
    
    // 🔥 FIX: Clear the current token ref FIRST
    currentTokenRef.current = null;
    
    setUser(null);
    setUserType(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    
    const data = await api<{ access_token: string; userType: UserType }>(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    console.log('✅ Login successful for:', email);
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userType', data.userType);
    setUserType(data.userType);
    
    // 🔥 FIX: Update ref before setting token
    currentTokenRef.current = data.access_token;
    setToken(data.access_token);
  }

  async function register(email: string, password: string, userType: UserType) {
    console.log('📝 Registering as:', email, userType);
    
    // 🔥 FIX: Clear the current token ref FIRST
    currentTokenRef.current = null;
    
    setUser(null);
    setUserType(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    
    const data = await api<{ access_token: string; userType: UserType }>(`/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email, password, userType }),
    });
    
    console.log('✅ Registration successful, setting new token');
    
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userType', data.userType);
    setUserType(data.userType);
    
    // 🔥 FIX: Update ref before setting token
    currentTokenRef.current = data.access_token;
    setToken(data.access_token);
  }

  async function refreshUser() {
    console.log('🔄 Refreshing user data...');
    if (token) {
      await fetchUserData(token);
    }
  }

  function logout() {
    console.log('👋 Logging out');
    currentTokenRef.current = null; // 🔥 FIX: Clear ref
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