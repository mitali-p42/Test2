import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

type Profile = {
  role: string | '—';
  interviewType: string | '—';
  yearsOfExperience: number | string | '—';
};

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile>({
    role: '—',
    interviewType: '—',
    yearsOfExperience: '—',
  });
  const [loading, setLoading] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);

  // Read token and trigger re-run when it becomes available
  const token = useMemo(() => localStorage.getItem('token') ?? '', [user?.email]);

  useEffect(() => {
    if (!token) return; // wait until token exists
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/interview-profile/me`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const text = await res.text(); // helpful for debugging
        const data = text ? JSON.parse(text) : {};

        if (!cancelled && res.ok) {
          const d = data?.profile ?? data;
          setProfile({
            role: d.role ?? '—',
            interviewType: d.interviewType ?? d.interview_type ?? '—',
            yearsOfExperience:
              d.yearsOfExperience ?? d.years_of_experience ?? '—',
          });
        } else if (!cancelled) {
          console.error('Failed to fetch interview profile:', res.status, text);
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]); // 👈 runs again when token appears

  
  async function handleConfirm() {
    setRequestingMic(true);
    
    try {
      console.log('🎤 Requesting microphone permission...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(
          'Audio recording is not supported in this browser.\n\n' +
          'Please use Chrome, Firefox, Edge, or Safari.'
        );
        setRequestingMic(false);
        return;
      }
    const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
    stream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone permission granted');

      // Navigate to interview
      navigate('/interview', { state: { profile } });
      
    } catch (err: any) {
      console.error('❌ Microphone permission error:', err);
      
      let errorMessage = 'Failed to access microphone';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 
          '🎤 Microphone Access Denied\n\n' +
          'To proceed with the interview, you need to:\n\n' +
          '1. Click the 🔒 lock icon in your browser\'s address bar\n' +
          '2. Allow microphone access for this site\n' +
          '3. Refresh the page and try again\n\n' +
          'Or check your browser settings to enable microphone permissions.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 
          '🎤 No Microphone Found\n\n' +
          'Please connect a microphone and try again.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 
          '🎤 Browser Not Supported\n\n' +
          'Please use Chrome, Firefox, Edge, or Safari for the best experience.';
      } else {
        errorMessage = `Microphone error: ${err.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setRequestingMic(false);
    }
    }
  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <h1>Welcome{user?.email ? `, ${user.email}` : ''}.</h1>

      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
        <h2 style={{ marginTop: 0 }}>Interview Details</h2>

        {loading ? (
          <p>Loading interview details...</p>
        ) : (
          <>
            <p><strong>Role:</strong> {profile.role}</p>
            <p><strong>Interview type:</strong> {profile.interviewType}</p>
          </>
        )}

        <p style={{ marginTop: 16 }}>
          Please click <strong>Confirm</strong> to start the interview and proceed with the given information.
        </p>

        {/* 👇 UPDATED: Add loading state and better styling */}
        <button 
          onClick={handleConfirm} 
          disabled={requestingMic}
          style={{ 
            padding: '10px 14px', 
            borderRadius: 10, 
            border: 0, 
            background: requestingMic ? '#9ca3af' : '#111827', 
            color: '#fff', 
            cursor: requestingMic ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          {requestingMic ? '🎤 Requesting permission...' : 'Confirm'}
        </button>

        {/* 👇 NEW: Info message */}
        <p style={{ 
          marginTop: 12, 
          fontSize: 14, 
          color: '#6b7280',
          lineHeight: 1.5 
        }}>
          ℹ️ You'll be asked to grant microphone permission to proceed with the voice interview.
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );
}