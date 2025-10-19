// frontend/src/pages/Results.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

type QuestionResult = {
  questionId: string;
  questionNumber: number;
  questionCategory: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  question: string;
  answer: string | null;
  scores: {
    overall: number | null;
    technical: number | null;
    communication: number | null;
    depth: number | null;
    problemSolving: number | null;
    roleRelevance: number | null;
  };
  feedback: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
  keyInsights: string[] | null;
  wordCount: number | null;
  confidence: 'low' | 'medium' | 'high' | null;
  redFlags: string[] | null;
  followUpQuestions: string[] | null;
  answeredAt: string;
};

type DifficultyBreakdown = {
  difficulty: string;
  averageScore: number;
  questionsAsked: number;
};

type SessionResults = {
  session: {
    sessionId: string;
    userId: string;
    userEmail: string;
    role: string;
    interviewType: string;
    status: string;
    totalQuestions: number;
  };
  questions: QuestionResult[];
  summary: {
    overallPerformance: {
      averageScore: number;
      grade: string;
      totalAnswered: number;
      totalQuestions: number;
    };
    difficultyBreakdown: DifficultyBreakdown[];
  };
};

export default function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<SessionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    fetchResults();
  }, [sessionId]);

  async function fetchResults() {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/interview/sessions/${sessionId}/results`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch results');
      }

      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      console.error('❌ Failed to fetch results:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score: number | null): string {
    if (score === null) return '#9ca3af';
    if (score >= 85) return '#059669';
    if (score >= 70) return '#3b82f6';
    if (score >= 55) return '#f59e0b';
    return '#ef4444';
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
        <p style={{ color: '#6b7280' }}>Loading your results...</p>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          padding: 24,
          background: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: 12,
          textAlign: 'center',
        }}>
          <h2 style={{ color: '#991b1b', marginTop: 0 }}>⚠️ Error</h2>
          <p style={{ color: '#991b1b' }}>{error || 'Failed to load results'}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              background: '#111827',
              color: 'white',
              border: 0,
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { session, questions, summary } = results;
  const completionRate = (summary.overallPerformance.totalAnswered / summary.overallPerformance.totalQuestions) * 100;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f9fafb',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'white',
          padding: 32,
          borderRadius: 16,
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: 8 }}>Interview Results</h1>
              <p style={{ color: '#6b7280', margin: 0 }}>
                <strong>Role:</strong> {capitalize(session.role)} • 
                <strong> Type:</strong> {capitalize(session.interviewType)}
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '8px 16px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Back to Home
            </button>
          </div>

          {/* Overall Score */}
          <div style={{
            marginTop: 24,
            padding: 24,
            background: `linear-gradient(135deg, ${getScoreColor(summary.overallPerformance.averageScore)}15, ${getScoreColor(summary.overallPerformance.averageScore)}05)`,
            borderRadius: 12,
            border: `2px solid ${getScoreColor(summary.overallPerformance.averageScore)}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: getScoreColor(summary.overallPerformance.averageScore),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
              }}>
                <div style={{ fontSize: 32 }}>{summary.overallPerformance.averageScore}</div>
                <div style={{ fontSize: 14 }}>/ 100</div>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, marginBottom: 8 }}>{summary.overallPerformance.grade}</h2>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Completed {summary.overallPerformance.totalAnswered} of {summary.overallPerformance.totalQuestions} questions
                  ({completionRate.toFixed(0)}%)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Difficulty Breakdown */}
        {summary.difficultyBreakdown.length > 0 && (
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 16,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
          </div>
        )}

        {/* Question-by-Question Breakdown */}
        <div style={{
          background: 'white',
          padding: 32,
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ marginTop: 0 }}>Detailed Question Analysis</h2>
          
          {questions.map((q, idx) => (
            <div
              key={q.questionId}
              style={{
                padding: 24,
                background: '#f9fafb',
                borderRadius: 12,
                marginBottom: idx < questions.length - 1 ? 16 : 0,
                border: '1px solid #e5e7eb',
              }}
            >
              {/* Question Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>Question {q.questionNumber}</h3>
                    {/* {q.difficulty && (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: getDifficultyColor(q.difficulty),
                        color: getDifficultyTextColor(q.difficulty),
                      }}>
                        {q.difficulty === 'easy' ? '🟢 Easy' : 
                         q.difficulty === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                      </span>
                    )} */}
                    {q.questionCategory && (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#e0e7ff',
                        color: '#3730a3',
                      }}>
                        {capitalize(q.questionCategory)}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>{q.question}</p>
                </div>
                {q.scores.overall !== null && (
                  <div style={{
                    marginLeft: 16,
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: getScoreColor(q.scores.overall),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 20 }}>{q.scores.overall}</div>
                    <div style={{ fontSize: 10 }}>/ 100</div>
                  </div>
                )}
              </div>

              {/* Score Breakdown */}
              {q.scores.overall !== null && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                  padding: 16,
                  background: 'white',
                  borderRadius: 8,
                }}>
                  {[
                    { label: 'Technical', value: q.scores.technical },
                    { label: 'Communication', value: q.scores.communication },
                    { label: 'Depth', value: q.scores.depth },
                    { label: 'Problem Solving', value: q.scores.problemSolving },
                  ].map((score) => (
                    score.value !== null && (
                      <div key={score.label}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          {score.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1,
                            height: 8,
                            background: '#e5e7eb',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${score.value}%`,
                              height: '100%',
                              background: getScoreColor(score.value),
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 32 }}>
                            {score.value}
                          </span>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Answer */}
              {q.answer && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, color: '#6b7280' }}>
                    Your Answer {q.wordCount && `(${q.wordCount} words)`}
                  </h4>
                  <p style={{
                    margin: 0,
                    padding: 12,
                    background: 'white',
                    borderRadius: 8,
                    lineHeight: 1.6,
                    color: '#374151',
                    fontSize: 14,
                  }}>
                    {q.answer}
                  </p>
                </div>
              )}

              {/* Feedback */}
              {q.feedback && (
                <div style={{
                  padding: 16,
                  background: '#dbeafe',
                  borderRadius: 8,
                  marginBottom: 16,
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, color: '#1e40af' }}>
                    💬 Feedback
                  </h4>
                  <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14, color: '#1e3a8a' }}>
                    {q.feedback}
                  </p>
                </div>
              )}

              {/* Strengths & Improvements */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                {q.strengths && q.strengths.length > 0 && (
                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, color: '#059669' }}>
                      ✅ Strengths
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                      {q.strengths.map((s, i) => (
                        <li key={i} style={{ color: '#065f46', marginBottom: 4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {q.improvements && q.improvements.length > 0 && (
                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, color: '#ea580c' }}>
                      📈 Areas for Improvement
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                      {q.improvements.map((i, idx) => (
                        <li key={idx} style={{ color: '#9a3412', marginBottom: 4 }}>{i}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

            
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 32px',
              background: '#111827',
              color: 'white',
              border: 0,
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}