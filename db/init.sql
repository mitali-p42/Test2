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
  skills TEXT[] DEFAULT '{}', -- 🆕 Add skills array
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
  skills TEXT[] DEFAULT '{}', -- 🆕 Add skills array
  status VARCHAR(20) DEFAULT 'pending',
  current_question_index INT DEFAULT 0,
  total_questions INT DEFAULT 5,
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

-- Rest of interview_qa table unchanged...
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
  overall_score INT,
  technical_accuracy INT,
  communication_clarity INT,
  depth_of_knowledge INT,
  problem_solving_approach INT,
  relevance_to_role INT,
  feedback TEXT,
  strengths TEXT[],
  improvements TEXT[],
  key_insights TEXT[],
  word_count INT,
  answer_duration_seconds INT,
  confidence VARCHAR(10),
  red_flags TEXT[],
  follow_up_questions TEXT[],
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
ALTER TABLE interview_profiles 
  ADD COLUMN IF NOT EXISTS total_questions INT DEFAULT 5 
  CHECK (total_questions >= 1 AND total_questions <= 20);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_interview_profiles_user_id ON interview_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_profiles_email ON interview_profiles(email);
CREATE INDEX IF NOT EXISTS idx_interview_profiles_skills ON interview_profiles USING GIN(skills); -- 🆕
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_tab_switches ON interview_sessions(tab_switches) WHERE tab_switches > 0;
CREATE INDEX IF NOT EXISTS idx_interview_sessions_skills ON interview_sessions USING GIN(skills); -- 🆕
CREATE INDEX IF NOT EXISTS idx_interview_qa_session_id ON interview_qa(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_qa_user_id ON interview_qa(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_qa_overall_score ON interview_qa(overall_score);
CREATE INDEX IF NOT EXISTS idx_interview_qa_difficulty ON interview_qa(difficulty);
CREATE INDEX IF NOT EXISTS idx_interview_profiles_total_questions ON interview_profiles(total_questions);
-- Seed data with skills
INSERT INTO users (id, email, password_hash)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a@gmail.com', 
  crypt('12345678', gen_salt('bf'))
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO interview_profiles (user_id, email, years_of_experience, role, interview_type, skills)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a@gmail.com', 
  4.0, 
  'product manager', 
  'technical',
  ARRAY[
    'product roadmapping',
    'agile methodologies',
    'user research',
    'data analysis',
    'stakeholder management',
    'SQL',
    'A/B testing',
    'feature prioritization',
    'API design',
    'metrics and KPIs'
  ]
)

UPDATE interview_profiles 
SET total_questions = 5 
WHERE total_questions IS NULL;

ON CONFLICT DO NOTHING;