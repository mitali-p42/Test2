import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Interview from './pages/Interview';
import Results from './pages/Results';
import RecruiterCreateCandidate from './pages/RecruiterCreateCandidate';
import RecruiterCandidates from './pages/RecruiterCandidates';
import { useAuth } from './auth/AuthContext';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RecruiterRoute({ children }: { children: React.ReactNode }) {
  const { token, userType } = useAuth();
  
  if (!token) return <Navigate to="/login" replace />;
  if (userType !== 'recruiter') return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { 
    path: '/', 
    element: <PrivateRoute><Home /></PrivateRoute> 
  },
  { 
    path: '/interview', 
    element: <PrivateRoute><Interview /></PrivateRoute> 
  },
  { 
    path: '/results/:sessionId', 
    element: <PrivateRoute><Results /></PrivateRoute> 
  },
  { 
    path: '/recruiter/create-candidate', 
    element: <RecruiterRoute><RecruiterCreateCandidate /></RecruiterRoute> 
  },
  { 
    path: '/recruiter/candidates', 
    element: <RecruiterRoute><RecruiterCandidates /></RecruiterRoute> 
  },
  { 
    path: '/login', 
    element: <Login /> 
  },
  { 
    path: '*', 
    element: <Navigate to="/" replace /> 
  },
]);