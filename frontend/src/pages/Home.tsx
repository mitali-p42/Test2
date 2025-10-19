import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

type Profile = {
  role: string | '—';
  interviewType: string | '—';
  yearsOfExperience: number | string | '—';
};

// 🔎 Lightweight JWT payload decoder (no libs)
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
  });
  const [loading, setLoading] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  // 🆕 Environment & readiness
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
    if (!navigator.permissions) {
      console.log('⚠️ Permissions API not available');
      return;
    }
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

  // 🆕 Detect if a microphone device exists
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
          const d = data?.profile ?? data;
          setProfile({
            role: d.role ?? '—',
            interviewType: d.interviewType ?? d.interview_type ?? '—',
            yearsOfExperience: d.yearsOfExperience ?? d.years_of_experience ?? '—',
          });
        } else if (!cancelled) {
          console.error('Failed to fetch profile:', res.status, text);
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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

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

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        errorMessage = '🎤 Microphone Access Denied';
        instructions =
          '\n\nTo enable microphone access:\n\n' +
          '**Chrome/Edge:**\n' +
          '1. Click the 🔒 or 🛡️ icon in the address bar\n' +
          '2. Find "Microphone" in the permissions list\n' +
          '3. Select "Allow"\n' +
          '4. Refresh this page\n\n' +
          '**Firefox:**\n' +
          '1. Click the 🔒 icon in the address bar\n' +
          '2. Click the "X" next to blocked permissions\n' +
          '3. Refresh and try again\n\n' +
          '**Safari:**\n' +
          '1. Go to Safari → Settings → Websites → Microphone\n' +
          '2. Find this website and allow access\n' +
          '3. Refresh this page';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '🎤 No Microphone Found';
        instructions = '\n\nPlease:\n1. Connect a microphone\n2. Refresh this page\n3. Try again';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = '🎤 Browser Not Supported';
        instructions = '\n\nPlease use:\n- Chrome\n- Firefox\n- Edge\n- Safari (macOS/iOS)';
      } else if (err.name === 'NotReadableError') {
        errorMessage = '🎤 Microphone In Use';
        instructions =
          '\n\nYour microphone might be in use by another app.\n\n1. Close other apps using the mic\n2. Refresh this page\n3. Try again';
      } else {
        instructions = `\n\nTechnical error: ${err.message}`;
      }

      alert(errorMessage + instructions);
    } finally {
      setRequestingMic(false);
    }
  }

  // 🆕 Quick mic test (doesn’t navigate; just requests, then stops)
  async function handleMicTest() {
    setMicTested('idle');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported');
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      setMicTested('ok');
      setPermissionState('granted');
    } catch (e) {
      setMicTested('failed');
    }
  }

  function getPermissionBadge() {
    if (permissionState === 'granted') {
      return <span style={{ color: '#059669', fontSize: 14 }}>✅ Microphone allowed</span>;
    }
    if (permissionState === 'denied') {
      return <span style={{ color: '#dc2626', fontSize: 14 }}>❌ Microphone blocked - click below for help</span>;
    }
    return <span style={{ color: '#6b7280', fontSize: 14 }}>🎤 Microphone permission needed</span>;
  }

  const initial = (resolvedEmail || '?').charAt(0).toUpperCase();
  const startDisabled =
    requestingMic || !readyChecked || (hasMicDevice === false) || permissionState === 'denied';

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      {/* Top bar: logged-in + logout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            aria-hidden
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
            title={resolvedEmail || 'Unknown user'}
          >
            {initial}
          </div>
          <div style={{ fontSize: 14, color: '#374151' }}>
            <strong>Logged in as:</strong>{' '}
            <span style={{ color: '#111827' }}>{resolvedEmail || '—'}</span>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            padding: '8px 14px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Logout
        </button>
      </div>

      <h1>Welcome{resolvedEmail ? `, ${resolvedEmail}` : ''}.</h1>

      <div style={{ marginBottom: 16, padding: 12, background: '#f3f4f6', borderRadius: 8, fontSize: 14 }}>
        {getPermissionBadge()}
      </div>

      {/* 🆕 Before you start panel */}
      <div style={{
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#ffffff',
        marginBottom: 16
      }}>
        <h2 style={{ marginTop: 0 }}>Before you start</h2>
        <ul style={{ margin: '8px 0 0 18px', color: '#374151', lineHeight: 1.6 }}>
          <li>Choose a <strong>quiet room</strong> with minimal background noise.</li>
          <li>Use <strong>headphones</strong> or a dedicated mic for clearer audio.</li>
          <li>Ensure a <strong>stable internet</strong> connection.</li>
        </ul>

        {/* Environment quick checks */}
        <div style={{
          marginTop: 12,
          padding: 12,
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          fontSize: 14
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <EnvItem ok={httpsOk} label="Secure connection (HTTPS)" />
            <EnvItem
              ok={hasMicDevice === true}
              label={hasMicDevice === false ? 'Microphone not found' : 'Microphone detected'}
              pending={hasMicDevice === null}
            />
            <EnvItem
              ok={permissionState === 'granted'}
              label={permissionState === 'granted' ? 'Mic permission granted' : 'Mic permission needed'}
              warn={permissionState === 'denied'}
            />
            <EnvItem
              ok={micTested === 'ok'}
              label={micTested === 'ok' ? 'Mic test passed' : 'Mic test not run'}
              pending={micTested === 'idle'}
              warn={micTested === 'failed'}
            />
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleMicTest}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#f3f4f6',
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              🔊 Test microphone
            </button>
            {permissionState === 'denied' && (
              <span style={{ color: '#dc2626', fontSize: 13 }}>
                Mic blocked. Use the 🔒 icon in your address bar to allow access, then refresh.
              </span>
            )}
          </div>
        </div>

        {/* Ready confirmation */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={readyChecked}
            onChange={e => setReadyChecked(e.target.checked)}
          />
          I’m in a quiet place, my mic works, and I’m ready to begin.
        </label>
      </div>

      <div style={{
        marginTop: 16,
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fafafa'
      }}>
        <h2 style={{ marginTop: 0 }}>Interview Details</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p><strong>Role:</strong> {capitalize(profile.role)}</p>
            <p><strong>Type:</strong> {capitalize(profile.interviewType)}</p>
            <p><strong>Experience:</strong> {profile.yearsOfExperience} years</p>
          </>
        )}

        <p style={{
          marginTop: 16,
          padding: 12,
          background: '#dbeafe',
          borderRadius: 8,
          fontSize: 14
        }}>
          ℹ️ <strong>Tip:</strong> You can pause briefly to think. Speak clearly and keep answers focused.
        </p>

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
            fontSize: 16,
            marginTop: 12
          }}
          title={!readyChecked ? 'Please confirm readiness' : undefined}
        >
          {requestingMic ? '🎤 Requesting permission...' : '🎤 Start Interview'}
        </button>

        {permissionState === 'denied' && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: 8,
            fontSize: 14
          }}>
            <strong>⚠️ Microphone Blocked</strong>
            <p style={{ marginTop: 8, marginBottom: 0 }}>
              Click the 🔒 icon in your browser's address bar and allow microphone access, then refresh this page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small status pill used in Environment checks */
function EnvItem({
  ok,
  label,
  pending,
  warn
}: { ok?: boolean; label: string; pending?: boolean; warn?: boolean }) {
  const bg = pending ? '#f3f4f6' : ok ? '#ecfdf5' : warn ? '#fee2e2' : '#fff7ed';
  const bd = pending ? '#e5e7eb' : ok ? '#10b981' : warn ? '#ef4444' : '#f59e0b';
  const icon = pending ? '⏳' : ok ? '✅' : warn ? '❌' : '⚠️';
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderRadius: 999,
      border: `1px solid ${bd}`,
      background: bg,
      fontSize: 13
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
