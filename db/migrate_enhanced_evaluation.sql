-- db/migrate_enhanced_evaluation.sql
-- Run this to upgrade existing database to enhanced evaluation schema

BEGIN;

-- 🆕 Add new columns to interview_qa table
ALTER TABLE interview_qa 
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS question_category TEXT,
  ADD COLUMN IF NOT EXISTS overall_score INT,
  ADD COLUMN IF NOT EXISTS technical_accuracy INT,
  ADD COLUMN IF NOT EXISTS communication_clarity INT,
  ADD COLUMN IF NOT EXISTS depth_of_knowledge INT,
  ADD COLUMN IF NOT EXISTS problem_solving_approach INT,
  ADD COLUMN IF NOT EXISTS relevance_to_role INT,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS strengths TEXT[],
  ADD COLUMN IF NOT EXISTS improvements TEXT[],
  ADD COLUMN IF NOT EXISTS key_insights TEXT[],
  ADD COLUMN IF NOT EXISTS word_count INT,
  ADD COLUMN IF NOT EXISTS answer_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS confidence VARCHAR(10),
  ADD COLUMN IF NOT EXISTS red_flags TEXT[],
  ADD COLUMN IF NOT EXISTS follow_up_questions TEXT[];

-- 🆕 Populate user_id from session relationship
UPDATE interview_qa qa
SET user_id = s.user_id
FROM interview_sessions s
WHERE qa.session_id = s.session_id
AND qa.user_id IS NULL;

-- 🆕 Add foreign key constraint for user_id
ALTER TABLE interview_qa
  ADD CONSTRAINT fk_qa_user
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- 🆕 Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_interview_qa_user_id ON interview_qa(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_qa_overall_score ON interview_qa(overall_score);
CREATE INDEX IF NOT EXISTS idx_interview_qa_question_category ON interview_qa(question_category);

-- 🆕 Create analytics views
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

COMMIT;

-- Verification queries
SELECT 'Migration complete! Verification:' as status;
SELECT COUNT(*) as total_qa_records FROM interview_qa;
SELECT COUNT(*) as records_with_user_id FROM interview_qa WHERE user_id IS NOT NULL;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'interview_qa' 
ORDER BY ordinal_position;