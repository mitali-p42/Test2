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
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const token = useMemo(() => localStorage.getItem('token') ?? '', [user?.email]);

  // 🆕 Helper to capitalize
  const capitalize = (str: string | '—') => {
    if (str === '—') return str;
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Check existing microphone permission on load
  useEffect(() => {
    if (!navigator.permissions) {
      console.log('⚠️ Permissions API not available');
      return;
    }

    navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
      console.log('🎤 Current mic permission:', result.state);
      setPermissionState(result.state as any);
      
      result.addEventListener('change', () => {
        console.log('🎤 Permission changed to:', result.state);
        setPermissionState(result.state as any);
      });
    }).catch(err => {
      console.log('⚠️ Cannot query mic permission:', err);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
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

    return () => { cancelled = true; };
  }, [token]);

  async function handleConfirm() {
    setRequestingMic(true);
    
    try {
      console.log('🎤 Requesting microphone permission...');
      console.log('   - Current permission state:', permissionState);
      console.log('   - Browser:', navigator.userAgent);
      console.log('   - HTTPS:', window.location.protocol === 'https:');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      console.log('🎤 Calling getUserMedia...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      console.log('✅ Permission granted! Stream:', stream);
      console.log('   - Audio tracks:', stream.getAudioTracks().length);
      
      stream.getTracks().forEach(track => {
        console.log('⏹️ Stopping track:', track.label);
        track.stop();
      });

      setPermissionState('granted');
      console.log('✅ Navigating to interview...');

      navigate('/interview', { state: { profile } });
      
    } catch (err: any) {
      console.error('❌ Microphone error:', err);
      console.error('   - Error name:', err.name);
      console.error('   - Error message:', err.message);
      
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
        instructions = '\n\nYour microphone might be in use by another app.\n\n1. Close other apps using the mic\n2. Refresh this page\n3. Try again';
      } else {
        instructions = `\n\nTechnical error: ${err.message}`;
      }
      
      alert(errorMessage + instructions);
    } finally {
      setRequestingMic(false);
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

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <h1>Welcome{user?.email ? `, ${user.email}` : ''}.</h1>

      <div style={{ 
        marginBottom: 16, 
        padding: 12, 
        background: '#f3f4f6', 
        borderRadius: 8,
        fontSize: 14,
      }}>
        {getPermissionBadge()}
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
          fontSize: 14,
        }}>
          ℹ️ <strong>Next step:</strong> Click "Start Interview" below. You'll be asked to allow microphone access.
        </p>

        <button 
          onClick={handleConfirm} 
          disabled={requestingMic}
          style={{ 
            padding: '12px 24px', 
            borderRadius: 10, 
            border: 0, 
            background: requestingMic ? '#9ca3af' : '#111827', 
            color: '#fff', 
            cursor: requestingMic ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 16,
            marginTop: 12,
          }}
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
            fontSize: 14,
          }}>
            <strong>⚠️ Microphone Blocked</strong>
            <p style={{ marginTop: 8, marginBottom: 0 }}>
              Click the 🔒 icon in your browser's address bar and allow microphone access.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={logout} style={{ 
          padding: '8px 16px', 
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          cursor: 'pointer',
        }}>
          Logout
        </button>
      </div>
    </div>
  );
}