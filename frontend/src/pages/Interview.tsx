// frontend/src/pages/Interview.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VoiceInterview from '../components/VoiceInterview';

type Profile = {
  role: string;
  interviewType: string;
  yearsOfExperience: number | string;
  skills?: string[];
  totalQuestions?: number; // 🆕 Add this field
};

export default function Interview() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = location.state?.profile as Profile | undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'creating' | 'ready' | 'completed'>('creating');

  const capitalize = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    if (!profile) {
      navigate('/');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/interview/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: profile.role,
            interviewType: profile.interviewType,
            yearsOfExperience: profile.yearsOfExperience,
            skills: profile.skills || [],
            totalQuestions: profile.totalQuestions || 5, // 🆕 Pass totalQuestions to backend
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSessionId(data.sessionId);

          await fetch(`${import.meta.env.VITE_API_BASE}/interview/sessions/${data.sessionId}/start`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          });

          setStatus('ready');
        }
      } catch (err) {
        console.error('Failed to create session:', err);
        alert('Failed to start interview');
        navigate('/');
      }
    })();
  }, [profile, navigate]);

  function handleComplete() {
    setStatus('completed');
    alert('Interview completed! Check your results.');
    navigate('/');
  }

  if (!profile) return null;

  if (status === 'creating') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Setting up your interview...</h2>
          <p style={{ color: '#6b7280', marginTop: 8 }}>
            Preparing {profile.totalQuestions || 5} questions for you
          </p>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>✅ Interview Completed!</h2>
          <button style={styles.button} onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 800 }}>
        <h1 style={styles.title}>{capitalize(profile.interviewType)} Interview</h1>
        <p style={{ color: '#374151', marginBottom: 8 }}>
          <strong>Role:</strong> {capitalize(profile.role)}
        </p>
        <p style={{ color: '#374151', marginBottom: 12 }}>
          <strong>Total Questions:</strong> {profile.totalQuestions || 5}
        </p>

        <div style={styles.instructions}>
          <h3 style={{ marginTop: 0 }}>📝 Instructions</h3>
          <ul style={{ marginTop: 8, color: '#1f2937', lineHeight: 1.6 }}>
            <li>Find a <strong>quiet, well-lit</strong> room before starting.</li>
            <li>Ensure your <strong>microphone</strong> and <strong>internet</strong> connection are stable.</li>
            <li>Answer questions clearly and naturally — you'll be recorded.</li>
            <li>You may take a short pause before responding.</li>
            <li>You'll be asked <strong>{profile.totalQuestions || 5} questions</strong> in total.</li>
            <li>Press <strong>"End Interview"</strong> if you need to stop early.</li>
          </ul>
        </div>

        {sessionId && (
          <div style={{ marginTop: 24 }}>
            <VoiceInterview
              sessionId={sessionId}
              profile={profile}
              onComplete={() => {}} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* 🎨 Simple inline styles for a light, modern look */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#e0f2feff', // light blue background
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '48px 16px',
  },
  card: {
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '24px 32px',
    width: '100%',
    maxWidth: 600,
  },
  title: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 24,
    color: '#111827',
  },
  instructions: {
    marginTop: 16,
    background: '#f0f9ff',
    borderRadius: 8,
    border: '1px solid #bae6fd',
    padding: 16,
  },
  button: {
    marginTop: 16,
    padding: '10px 20px',
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
};