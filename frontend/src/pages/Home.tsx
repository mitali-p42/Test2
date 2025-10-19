import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

type Profile = {
  role: string | '—';
  interviewType: string | '—';
  yearsOfExperience: number | string | '—';
  skills?: string[];
  totalQuestions?: number;
  companyName?: string | null;
  hasProfile?: boolean;
};

function getEmailFromToken(token: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload?.email || payload?.sub || undefined;
  } catch {
    return undefined;
  }
}

export default function Home() {
  const { user, logout, userType } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile>({
    role: '—',
    interviewType: '—',
    yearsOfExperience: '—',
    skills: [],
    totalQuestions: 5,
    companyName: null,
    hasProfile: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [requestingMic, setRequestingMic] = useState(false);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [hasMicDevice, setHasMicDevice] = useState<boolean | null>(null);
  const [httpsOk] = useState<boolean>(window.location.protocol === 'https:');
  const [readyChecked, setReadyChecked] = useState(false);

  const token = useMemo(() => localStorage.getItem('token') ?? '', [user?.email]);
  const resolvedEmail = useMemo(
    () => user?.email || getEmailFromToken(token) || '',
    [user?.email, token]
  );

  const capitalize = (str: string | '—') => {
    if (str === '—') return str;
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Check mic permission
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(result => {
        setPermissionState(result.state as any);
        result.addEventListener('change', () => {
          setPermissionState(result.state as any);
        });
      })
      .catch(err => {
        console.log('⚠️ Cannot query mic permission:', err);
      });
  }, []);

  // Detect microphone device
  useEffect(() => {
    let mounted = true;
    async function checkDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) {
          if (mounted) setHasMicDevice(null);
          return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioIn = devices.some(d => d.kind === 'audioinput');
        if (mounted) setHasMicDevice(hasAudioIn);
      } catch {
        if (mounted) setHasMicDevice(null);
      }
    }
    checkDevices();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch profile
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/interview-profile/me`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!cancelled && res.ok) {
          const d = data;
          setProfile({
            role: d.role ?? '—',
            interviewType: d.interviewType ?? d.interview_type ?? '—',
            yearsOfExperience: d.yearsOfExperience ?? d.years_of_experience ?? '—',
            skills: d.skills ?? [],
            totalQuestions: d.totalQuestions ?? 5,
            companyName: d.companyName ?? null,
            hasProfile: d.role !== '—' && d.role !== null,
          });
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
  }, [token]);

  async function handleConfirm() {
    setRequestingMic(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      navigate('/interview', { state: { profile } });
    } catch (err: any) {
      let errorMessage = 'Failed to access microphone';
      let instructions = '';

      if (err.name === 'NotAllowedError') {
        setPermissionState('denied');
        errorMessage = '🎤 Microphone Access Denied';
        instructions = '\n\nTo enable: Click 🔒 in address bar → Allow microphone → Refresh';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '🎤 No Microphone Found';
        instructions = '\n\nConnect a microphone and refresh';
      }

      alert(errorMessage + instructions);
    } finally {
      setRequestingMic(false);
    }
  }

  const initial = (resolvedEmail || '?').charAt(0).toUpperCase();
  const startDisabled = requestingMic || !readyChecked || hasMicDevice === false || permissionState === 'denied';

  // 🆕 Recruiter Dashboard
  if (userType === 'recruiter') {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#1f2937',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              {initial}
            </div>
            <div style={{ fontSize: 14, color: '#374151' }}>
              <strong>Logged in as:</strong> {resolvedEmail || '—'} (Recruiter)
            </div>
          </div>
          <button 
            onClick={logout} 
            style={{ 
              padding: '8px 14px', 
              background: '#f3f4f6', 
              border: '1px solid #d1d5db', 
              borderRadius: 8, 
              cursor: 'pointer' 
            }}
          >
            Logout
          </button>
        </div>

        <h1>Recruiter Dashboard</h1>

        <div style={{
          padding: 24,
          background: '#eff6ff',
          border: '1px solid #bae6fd',
          borderRadius: 12,
          marginBottom: 24,
        }}>
          <h2 style={{ marginTop: 0 }}>💼 Create Candidate Profile</h2>
          <p style={{ color: '#374151', marginBottom: 16 }}>
            Create interview profiles for candidates. They'll receive access to their personalized interview.
          </p>
          <button
            onClick={() => navigate('/recruiter/create-candidate')}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 0,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Create New Candidate
          </button>
        </div>

        <div style={{
          padding: 24,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
        }}>
          <h2 style={{ marginTop: 0 }}>📊 My Candidates</h2>
          <button
            onClick={() => navigate('/recruiter/candidates')}
            style={{
              padding: '10px 20px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            View All Candidates
          </button>
        </div>
      </div>
    );
  }

  // 🆕 Candidate without profile
  if (!loading && !profile.hasProfile) {
    return (
      <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#1f2937',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              {initial}
            </div>
            <div style={{ fontSize: 14, color: '#374151' }}>
              <strong>Logged in as:</strong> {resolvedEmail || '—'}
            </div>
          </div>
          <button onClick={logout} style={{ padding: '8px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
            Logout
          </button>
        </div>

        <div style={{
          padding: 48,
          background: '#fef3c7',
          border: '2px solid #fbbf24',
          borderRadius: 16,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>No Interview Profile Found</h2>
          <p style={{ color: '#92400e', fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
            Your interview profile hasn't been set up yet. Please contact your recruiter to create your profile.
          </p>
          <p style={{ 
            fontSize: 14, 
            color: '#78350f', 
            background: 'white', 
            padding: 16, 
            borderRadius: 8,
            border: '1px solid #fbbf24',
          }}>
            💡 <strong>Tip:</strong> Your recruiter needs to create a profile with your email address, 
            job role, and required skills before you can start the interview.
          </p>
        </div>
      </div>
    );
  }

  // 🆕 Candidate with profile (existing flow)
  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#1f2937',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 14
            }}
          >
            {initial}
          </div>
          <div style={{ fontSize: 14, color: '#374151' }}>
            <strong>Logged in as:</strong> {resolvedEmail || '—'}
          </div>
        </div>
        <button onClick={logout} style={{ padding: '8px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      <h1>Welcome{resolvedEmail ? `, ${resolvedEmail}` : ''}.</h1>

      {/* Environment checks */}
      <div style={{ marginBottom: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#ffffff' }}>
        <h2 style={{ marginTop: 0 }}>Before you start</h2>
        <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <EnvItem ok={httpsOk} label="Secure HTTPS" />
            <EnvItem ok={hasMicDevice === true} label={hasMicDevice === false ? 'No mic' : 'Mic detected'} pending={hasMicDevice === null} />
            <EnvItem ok={permissionState === 'granted'} label={permissionState === 'granted' ? 'Mic allowed' : 'Mic needed'} warn={permissionState === 'denied'} />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={readyChecked} onChange={e => setReadyChecked(e.target.checked)} />
          I'm ready to begin
        </label>
      </div>

      {/* Interview Details */}
      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
        <h2 style={{ marginTop: 0 }}>Interview Details</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {profile.companyName && (
              <p><strong>Company:</strong> {profile.companyName}</p>
            )}
            <p><strong>Role:</strong> {capitalize(profile.role)}</p>
            <p><strong>Type:</strong> {capitalize(profile.interviewType)}</p>
            <p><strong>Experience:</strong> {profile.yearsOfExperience} years</p>
            <p><strong>Total Questions:</strong> {profile.totalQuestions ?? 5}</p>
          </>
        )}

        <button
          onClick={handleConfirm}
          disabled={startDisabled}
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            border: 0,
            background: startDisabled ? '#9ca3af' : '#111827',
            color: '#fff',
            cursor: startDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            marginTop: 12
          }}
        >
          {requestingMic ? '🎤 Requesting...' : '🎤 Start Interview'}
        </button>
      </div>
    </div>
  );
}

function EnvItem({ ok, label, pending, warn }: { ok?: boolean; label: string; pending?: boolean; warn?: boolean }) {
  const bg = pending ? '#f3f4f6' : ok ? '#ecfdf5' : warn ? '#fee2e2' : '#fff7ed';
  const bd = pending ? '#e5e7eb' : ok ? '#10b981' : warn ? '#ef4444' : '#f59e0b';
  const icon = pending ? '⏳' : ok ? '✅' : warn ? '❌' : '⚠️';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, border: `1px solid ${bd}`, background: bg, fontSize: 13 }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}