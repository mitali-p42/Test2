//RecruiterCreateCandidate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RecruiterCreateCandidate() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    candidateEmail: '',
    role: '',
    interviewType: 'technical',
    yearsOfExperience: 0,
    skills: '',
    totalQuestions: 5,
    companyName: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const skillsArray = formData.skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/interview-profile/create-candidate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            candidateEmail: formData.candidateEmail,
            role: formData.role,
            interviewType: formData.interviewType,
            yearsOfExperience: Number(formData.yearsOfExperience),
            skills: skillsArray,
            totalQuestions: Number(formData.totalQuestions),
            companyName: formData.companyName,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create candidate profile');
      }

      setSuccess(true);
      
      // Reset form
      setFormData({
        candidateEmail: '',
        role: '',
        interviewType: 'technical',
        yearsOfExperience: 0,
        skills: '',
        totalQuestions: 5,
        companyName: '',
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/recruiter/candidates');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to create candidate:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
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

      <div style={{
        background: 'white',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>Create Candidate Profile</h1>

        {success && (
          <div style={{
            padding: 16,
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: 8,
            marginBottom: 24,
            color: '#065f46',
          }}>
            ✅ Candidate profile created successfully! Redirecting...
          </div>
        )}

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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Candidate Email *
            </label>
            <input
              type="email"
              required
              value={formData.candidateEmail}
              onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
              placeholder="candidate@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0' }}>
              If this email doesn't exist, a new account will be created automatically
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Acme Inc."
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Role *
            </label>
            <input
              type="text"
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g. Senior Software Engineer"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Interview Type *
            </label>
            <select
              required
              value={formData.interviewType}
              onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
              <option value="phone screen">Phone Screen</option>
              <option value="system design">System Design</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={formData.yearsOfExperience}
              onChange={(e) => setFormData({ ...formData, yearsOfExperience: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Required Skills *
            </label>
            <textarea
              required
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="React, Node.js, TypeScript, AWS (comma-separated)"
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0' }}>
              Enter skills separated by commas
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Total Questions (1-20)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={formData.totalQuestions}
              onChange={(e) => setFormData({ ...formData, totalQuestions: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                padding: '12px 24px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 0,
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {loading ? 'Creating...' : 'Create Candidate Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}