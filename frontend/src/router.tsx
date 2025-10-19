import React from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Interview from './pages/Interview';
import Results from './pages/Results';
import RecruiterCreateCandidate from './pages/RecruiterCreateCandidate';
import RecruiterCandidates from './pages/RecruiterCandidates';
import { useAuth } from './auth/AuthContext';

function PrivateLayout() {
  const { token, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <Outlet />;
}

function RecruiterLayout() {
  const { token, userType, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (userType !== 'recruiter') {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PrivateLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/interview', element: <Interview /> },
      { path: '/results/:sessionId', element: <Results /> },
    ]
  },
  {
    path: '/recruiter',
    element: <RecruiterLayout />,
    children: [
      { path: 'create-candidate', element: <RecruiterCreateCandidate /> },
      { path: 'candidates', element: <RecruiterCandidates /> },
    ]
  },
  { path: '/login', element: <Login /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);