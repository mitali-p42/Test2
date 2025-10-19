import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

type Profile = {
  role: string | '—';
  interviewType: string | '—';
  yearsOfExperience: number | string | '—';
  skills?: string[];
  totalQuestions?: number;
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile>({
    role: '—',
    interviewType: '—',
    yearsOfExperience: '—',
    skills: [],
    totalQuestions: 5, // Default value of questions
  });
  
  const [loading, setLoading] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [hasMicDevice, setHasMicDevice] = useState<boolean | null>(null);
  const [httpsOk] = useState<boolean>(window.location.protocol === 'https:');
  const [readyChecked, setReadyChecked] = useState(false);
  const [micTested, setMicTested] = useState<'idle' | 'ok' | 'failed'>('idle');

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

  // Fetch profile including totalQuestions
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
          const d = data?.profile ?? data;
          setProfile({
            role: d.role ?? '—',
            interviewType: d.interviewType ?? d.interview_type ?? '—',
            yearsOfExperience: d.yearsOfExperience ?? d.years_of_experience ?? '—',
            skills: d.skills ?? [],
            totalQuestions: d.totalQuestions ?? 5,
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

  async function handleMicTest() {
    setMicTested('idle');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      setMicTested('ok');
      setPermissionState('granted');
    } catch {
      setMicTested('failed');
    }
  }

  const initial = (resolvedEmail || '?').charAt(0).toUpperCase();
  const startDisabled = requestingMic || !readyChecked || hasMicDevice === false || permissionState === 'denied';

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
            <EnvItem ok={micTested === 'ok'} label={micTested === 'ok' ? 'Mic tested' : 'Test mic'} pending={micTested === 'idle'} warn={micTested === 'failed'} />
          </div>
          <button onClick={handleMicTest} style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>
            🔊 Test microphone
          </button>
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
            <p><strong>Role:</strong> {capitalize(profile.role)}</p>
            <p><strong>Type:</strong> {capitalize(profile.interviewType)}</p>
            <p><strong>Experience:</strong> {profile.yearsOfExperience} years</p>
            <p><strong>Total Questions:</strong> {profile.totalQuestions ?? 5}</p> {/* 🆕 Display total questions */}
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