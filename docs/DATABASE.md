# 🎯 Interview Platform Database Schema

A PostgreSQL database for managing AI-powered technical interviews with candidate tracking, session management, and detailed Q&A analytics.

## 📊 Tables Overview

### `users`
The people using the platform - candidates getting interviewed and recruiters doing the hiring.

```sql
id                UUID (PK)
email             TEXT (unique)
password_hash     TEXT
user_type         'candidate' | 'recruiter'
created_at        TIMESTAMPTZ
```

### `interview_profiles`
Pre-configured interview setups with specific roles, skills, and question counts.

```sql
interview_id           UUID (PK)
user_id                UUID (FK → users)
email                  TEXT
role                   TEXT
interview_type         TEXT
years_of_experience    NUMERIC(3,1)
skills                 TEXT[]
total_questions        INT (1-20)
company_name           TEXT
recruiter_id           UUID (FK → users)
created_by_recruiter   BOOLEAN
created_at             TIMESTAMPTZ
updated_at             TIMESTAMPTZ
```

### `interview_sessions`
Active or completed interview instances tracking progress and monitoring behavior.

```sql
session_id                    UUID (PK)
user_id                       UUID (FK → users)
role                          TEXT
interview_type                TEXT
skills                        TEXT[]
status                        'pending' | etc.
current_question_index        INT
total_questions               INT
tab_switches                  INT
tab_switch_timestamps         TIMESTAMPTZ[]
terminated_for_tab_switches   BOOLEAN
started_at                    TIMESTAMPTZ
completed_at                  TIMESTAMPTZ
created_at                    TIMESTAMPTZ
updated_at                    TIMESTAMPTZ
```

**Anti-Cheating**: Tracks tab switches with timestamps to detect candidates looking up answers.

### `interview_qa`
Individual Q&A pairs with detailed scoring, feedback, and performance metrics.

```sql
qa_id                      UUID (PK)
session_id                 UUID (FK → interview_sessions)
user_id                    UUID (FK → users)
question_number            INT
question                   TEXT
question_category          TEXT
difficulty                 'easy' | 'medium' | 'hard'
answer                     TEXT
transcript                 TEXT
overall_score              INT
technical_accuracy         INT
communication_clarity      INT
depth_of_knowledge         INT
problem_solving_approach   INT
relevance_to_role          INT
feedback                   TEXT
strengths                  TEXT[]
improvements               TEXT[]
key_insights               TEXT[]
word_count                 INT
answer_duration_seconds    INT
confidence                 VARCHAR(10)
red_flags                  TEXT[]
follow_up_questions        TEXT[]
tested_skills              TEXT[]
evaluation                 JSONB
created_at                 TIMESTAMPTZ
```

**Unique Constraint**: (session_id, question_number) - one answer per question per session.

## 🔗 Relationships

```
users (1) ──→ (N) interview_profiles
users (1) ──→ (N) interview_sessions
users (1) ──→ (N) interview_qa

interview_sessions (1) ──→ (N) interview_qa
```

Recruiters can create profiles for candidates via `interview_profiles.recruiter_id`.

## ⚡ Key Features

- **Multi-dimensional Scoring**: Questions evaluated on 5+ different metrics
- **Rich Analytics**: Word count, duration, confidence levels, red flags
- **Skill Tracking**: Array-based skill tagging with GIN indexes for fast searches
- **Session Integrity**: Tab switch monitoring to ensure interview authenticity
- **Flexible Evaluation**: JSONB field for custom evaluation criteria
- **Cascade Deletes**: Clean up related records when users are removed

## 🚀 Performance Optimizations

- GIN indexes on skill arrays for fast containment queries
- Composite indexes on frequently queried fields
- Partial index on tab switches (only when > 0)
- Foreign key constraints for referential integrity