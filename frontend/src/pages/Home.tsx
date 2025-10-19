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

function getUserTypeFromToken(token: string | null): 'candidate' | 'recruiter' | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload?.userType || null;
  } catch {
    return null;
  }
}

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
  const { user, logout, userType, loading: authLoading } = useAuth();
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
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [hasMicDevice, setHasMicDevice] = useState<boolean | null>(null);
  const [httpsOk] = useState<boolean>(window.location.protocol === 'https:');
  const [readyChecked, setReadyChecked] = useState(false);

  const token = useMemo(() => localStorage.getItem('token') ?? '', []);
  
  // Get userType from token immediately - don't wait for auth to load
  const tokenUserType = useMemo(() => getUserTypeFromToken(token), [token]);
  
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

  // Fetch profile - ONLY for candidates
  useEffect(() => {
    // Check token userType first - if recruiter, skip immediately
    if (tokenUserType === 'recruiter') {
      return;
    }

    // If not a candidate, don't fetch
    if (tokenUserType !== 'candidate') {
      return;
      return;
    }

    if (!token) {
      return;
    }

    let cancelled = false;

    (async () => {
      setProfileLoading(true);
      
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/interview-profile/me`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('📡 Profile fetch response:', res.status);

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!cancelled) {
          if (res.ok) {
            const d = data;
            const hasActualProfile = d.role && d.role !== '—' && d.interviewType && d.interviewType !== '—';
            
            const profileData = {
              role: d.role ?? '—',
              interviewType: d.interviewType ?? d.interview_type ?? '—',
              yearsOfExperience: d.yearsOfExperience ?? d.years_of_experience ?? '—',
              skills: d.skills ?? [],
              totalQuestions: d.totalQuestions ?? 5,
              companyName: d.companyName ?? null,
              hasProfile: hasActualProfile,
            };
            console.log('✅ Profile loaded:', hasActualProfile ? 'HAS PROFILE' : 'NO PROFILE');
            setProfile(profileData);
          } else {
            console.log('📭 No profile found');
            setProfile({
              role: '—',
              interviewType: '—',
              yearsOfExperience: '—',
              skills: [],
              totalQuestions: 5,
              companyName: null,
              hasProfile: false,
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Error fetching profile:', err);
          setProfile({
            role: '—',
            interviewType: '—',
            yearsOfExperience: '—',
            skills: [],
            totalQuestions: 5,
            companyName: null,
            hasProfile: false,
          });
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tokenUserType]);

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

  // CHECK RECRUITER - redirect to create candidate page immediately
  const isRecruiter = tokenUserType === 'recruiter' || userType === 'recruiter';
  
  useEffect(() => {
    // Don't wait for auth to fully load if token shows recruiter
    if (tokenUserType === 'recruiter') {
      console.log('👔 Token shows recruiter, redirecting to create candidate');
      navigate('/recruiter/create-candidate', { replace: true });
    } else if (isRecruiter && !authLoading) {
      console.log('👔 Auth confirmed recruiter, redirecting to create candidate');
      navigate('/recruiter/create-candidate', { replace: true });
    }
  }, [isRecruiter, tokenUserType, authLoading, navigate]);

  // If recruiter, show brief loading while redirecting
  if (isRecruiter || tokenUserType === 'recruiter') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#6b7280' }}>Redirecting to create candidate...</p>
      </div>
    );
  }

  // Show loading while auth loads (but only for non-recruiters)
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Candidate without profile
  if (!profileLoading && !profile.hasProfile) {
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

  // Candidate with profile
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

      <h1>Welcome{resolvedEmail ? `, ${resolvedEmail}` : ''}.</h1>

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

      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
        <h2 style={{ marginTop: 0 }}>Interview Details</h2>
        {profileLoading ? (
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