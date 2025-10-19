import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type Candidate = {
  email: string;
  role: string;
  interviewType: string;
  companyName: string;
  skills: string[];
  totalQuestions: number;
  createdAt: string;
};

export default function RecruiterCandidates() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  async function fetchCandidates() {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/interview-profile/my-candidates`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch candidates');
      }

      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err: any) {
      console.error('Failed to fetch candidates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function capitalize(str: string): string {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          margin: '48px auto',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#6b7280' }}>Loading candidates...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 14px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <button
          onClick={() => navigate('/recruiter/create-candidate')}
          style={{
            padding: '10px 20px',
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
        background: 'white',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>My Candidates ({candidates.length})</h1>

        {error && (
          <div style={{
            padding: 16,
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: 8,
            marginBottom: 24,
            color: '#991b1b',
          }}>
            ❌ {error}
          </div>
        )}

        {candidates.length === 0 ? (
          <div style={{
            padding: 48,
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>No Candidates Yet</h3>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>
              Create your first candidate profile to get started
            </p>
            <button
              onClick={() => navigate('/recruiter/create-candidate')}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 0,
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Create Candidate Profile
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {candidates.map((candidate, index) => (
              <div
                key={index}
                style={{
                  padding: 20,
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: 4 }}>{candidate.email}</h3>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      Created on {formatDate(candidate.createdAt)}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 12px',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {candidate.totalQuestions} Questions
                  </div>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: 12,
                  marginTop: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Company</div>
                    <div style={{ fontWeight: 600 }}>{candidate.companyName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Role</div>
                    <div style={{ fontWeight: 600 }}>{capitalize(candidate.role)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Interview Type</div>
                    <div style={{ fontWeight: 600 }}>{capitalize(candidate.interviewType)}</div>
                  </div>
                </div>

                {candidate.skills && candidate.skills.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Required Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {candidate.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 12px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}