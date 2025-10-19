-- db/init.sql (UPDATED with tab switch tracking)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_id_email_unique UNIQUE (id, email)
);

CREATE TABLE IF NOT EXISTS interview_profiles (
  interview_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  interview_type TEXT,
  years_of_experience NUMERIC(3,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_interview_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  interview_type TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  current_question_index INT DEFAULT 0,
  total_questions INT DEFAULT 5,
  
  -- 🆕 Tab switch tracking columns
  tab_switches INT DEFAULT 0,
  tab_switch_timestamps TIMESTAMPTZ[] DEFAULT '{}',
  terminated_for_tab_switches BOOLEAN DEFAULT false,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_session_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Enhanced interview_qa table with detailed evaluation fields
CREATE TABLE IF NOT EXISTS interview_qa (
  qa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  question_number INT NOT NULL,
  question TEXT NOT NULL,
  question_category TEXT,
  difficulty VARCHAR(10),
  answer TEXT,
  transcript TEXT,
  
  -- Detailed Evaluation Scores (0-100)
  overall_score INT,
  technical_accuracy INT,
  communication_clarity INT,
  depth_of_knowledge INT,
  problem_solving_approach INT,
  relevance_to_role INT,
  
  -- Qualitative Assessment
  feedback TEXT,
  strengths TEXT[],
  improvements TEXT[],
  key_insights TEXT[],
  
  -- Metadata
  word_count INT,
  answer_duration_seconds INT,
  confidence VARCHAR(10),
  
  -- Red Flags and Follow-ups
  red_flags TEXT[],
  follow_up_questions TEXT[],
  
  -- Legacy JSONB field (kept for backward compatibility)
  evaluation JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_qa_session
    FOREIGN KEY (session_id) REFERENCES interview_sessions (session_id) ON DELETE CASCADE,
  CONSTRAINT fk_qa_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(session_id, question_number),
  CONSTRAINT chk_difficulty 
    CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_interview_profiles_user_id ON interview_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_profiles_email ON interview_profiles(email);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_tab_switches ON interview_sessions(tab_switches) WHERE tab_switches > 0;
CREATE INDEX IF NOT EXISTS idx_interview_qa_session_id ON interview_qa(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_qa_user_id ON interview_qa(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_qa_overall_score ON interview_qa(overall_score);
CREATE INDEX IF NOT EXISTS idx_interview_qa_difficulty ON interview_qa(difficulty);

-- Seed data
INSERT INTO users (id, email, password_hash)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a@gmail.com', 
  crypt('12345678', gen_salt('bf'))
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO interview_profiles (user_id, email, years_of_experience, role, interview_type)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a@gmail.com', 
  4.0, 
  'product manager', 
  'technical'
)
ON CONFLICT DO NOTHING;

-- Useful Views for Analytics

-- View: User Interview Performance Summary
CREATE OR REPLACE VIEW v_user_interview_summary AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT s.session_id) as total_interviews,
  COUNT(qa.qa_id) as total_questions_answered,
  ROUND(AVG(qa.overall_score), 2) as avg_overall_score,
  ROUND(AVG(qa.technical_accuracy), 2) as avg_technical_score,
  ROUND(AVG(qa.communication_clarity), 2) as avg_communication_score,
  MAX(s.created_at) as last_interview_date
FROM users u
LEFT JOIN interview_sessions s ON u.id = s.user_id
LEFT JOIN interview_qa qa ON s.session_id = qa.session_id
GROUP BY u.id, u.email;

-- View: Session Performance Details
CREATE OR REPLACE VIEW v_session_performance AS
SELECT 
  s.session_id,
  s.user_id,
  u.email,
  s.role,
  s.interview_type,
  s.status,
  COUNT(qa.qa_id) as questions_answered,
  ROUND(AVG(qa.overall_score), 2) as avg_score,
  ROUND(AVG(qa.technical_accuracy), 2) as avg_technical,
  ROUND(AVG(qa.communication_clarity), 2) as avg_communication,
  STRING_AGG(DISTINCT qa.confidence, ', ') as confidence_levels,
  s.created_at,
  s.completed_at
FROM interview_sessions s
JOIN users u ON s.user_id = u.id
LEFT JOIN interview_qa qa ON s.session_id = qa.session_id
GROUP BY s.session_id, s.user_id, u.email, s.role, s.interview_type, s.status, s.created_at, s.completed_at;

-- View: Question Category Performance
CREATE OR REPLACE VIEW v_category_performance AS
SELECT 
  u.email,
  qa.question_category,
  COUNT(*) as times_asked,
  ROUND(AVG(qa.overall_score), 2) as avg_score,
  ROUND(AVG(qa.technical_accuracy), 2) as avg_technical,
  ROUND(AVG(qa.communication_clarity), 2) as avg_communication
FROM interview_qa qa
JOIN users u ON qa.user_id = u.id
WHERE qa.question_category IS NOT NULL
GROUP BY u.email, qa.question_category
ORDER BY u.email, avg_score DESC;

-- 🆕 View: Interview Violations (Tab Switches)
CREATE OR REPLACE VIEW v_interview_violations AS
SELECT 
  s.session_id,
  s.user_id,
  u.email,
  s.role,
  s.interview_type,
  s.status,
  s.tab_switches,
  s.tab_switch_timestamps,
  s.terminated_for_tab_switches,
  s.current_question_index,
  s.total_questions,
  s.created_at,
  s.completed_at,
  CASE 
    WHEN s.terminated_for_tab_switches THEN 'Terminated for violations'
    WHEN s.tab_switches > 0 THEN 'Has violations'
    ELSE 'Clean'
  END as violation_status
FROM interview_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.tab_switches > 0 OR s.terminated_for_tab_switches = true
ORDER BY s.tab_switches DESC, s.created_at DESC;