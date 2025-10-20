# 🎤 AI-Powered Voice Interview Platform

A full-stack voice-based interview system with real-time speech recognition, AI-powered evaluation, and comprehensive performance analytics.

## 🌟 Features

### Core Functionality
- **🎙️ Voice-Based Interviews**: Real-time speech-to-text with browser-native recognition
- **🤖 AI Question Generation**: Dynamic questions using Groq's LLaMA 3.3 70B model
- **📊 Multi-Agent Evaluation**: Technical, communication, and role-specific assessments
- **🔊 Text-to-Speech**: Natural voice prompts using OpenAI TTS
- **💡 Smart Hints**: Context-aware hints for hard difficulty questions
- **🎯 Skills Tracking**: Monitors which skills are tested across questions
- **🚨 Anti-Cheating**: Tab switch detection with 3-strike termination
- **📈 Detailed Analytics**: Comprehensive performance breakdowns with skill-specific insights

### Security & Authentication
- **JWT-based authentication** with secure password hashing (bcrypt)
- **Protected routes** and role-based access control
- **Session management** with PostgreSQL persistence

### Interview Intelligence
- **Adaptive Difficulty**: Questions scaled to experience level (easy/medium/hard)
- **Silence Detection**: Auto-stops recording after 6 seconds of silence
- **Real-Time Transcription**: Live transcript display during recording
- **Comprehensive Scoring**: 6 evaluation dimensions per answer
  - Overall Score
  - Technical Accuracy
  - Communication Clarity
  - Depth of Knowledge
  - Problem-Solving Approach
  - Role Relevance

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Login/     │  │   Profile    │  │   Voice      │           │
│  │   Register   │→ │   Setup      │→ │   Interview  │→ Results  │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/JSON + JWT
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (NestJS)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │     Auth     │  │   Profile    │  │   Interview  │           │
│  │   Service    │  │   Service    │  │   Service    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                              ↓                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  AI Service  │  │   STT/TTS    │  │  Multi-Agent │           │
│  │  (Groq API)  │  │   (OpenAI)   │  │  Evaluator   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ TypeORM
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                         │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  users  │  │ profiles │  │ sessions │  │    qa    │          │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** 13+
- **Docker & Docker Compose** (optional)
- **API Keys**:
  - Groq API key ([groq.com](https://groq.com))
  - OpenAI API key ([platform.openai.com](https://platform.openai.com))

### Installation

#### Option 1: Docker (Recommended)
```bash
# Clone repository
git clone <repository-url>

# Configure environment
cd backend
cp .env.example .env
# Edit .env with your API keys

cd ../frontend
cp .env.example .env

# Start services
docker-compose up -d

# Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:4000
# PostgreSQL: localhost:5432
```

#### Option 2: Manual Setup
```bash
# 1. Start PostgreSQL
# Ensure PostgreSQL is running on port 5432

# 2. Setup Backend
cd backend
cp .env.example .env
# Edit .env with database URL and API keys
npm install
npm run start:dev

# 3. Setup Frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

### Environment Variables

**backend/.env**
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/jwt_auth_starter
JWT_SECRET=your_secure_secret_here
JWT_EXPIRES_IN=1d
PORT=4000
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
```

**frontend/.env**
```env
VITE_API_BASE=http://localhost:4000
```
### Multi-Agent Architecture

The platform uses three specialized AI agents for comprehensive evaluation:

#### 1. Technical Agent
- Evaluates technical accuracy and depth
- Assesses problem-solving methodology
- Identifies technical gaps and red flags
- Scores: `technicalAccuracy`, `depthOfKnowledge`, `problemSolvingApproach`

#### 2. Communication Agent
- Analyzes clarity and structure
- Evaluates conciseness and articulation
- Provides communication feedback
- Scores: `communicationClarity`

#### 3. Role-Specific Agent
- Assesses relevance to target role
- Evaluates experience alignment
- Generates follow-up questions
- Scores: `relevanceToRole`

### Scoring Dimensions

Each answer receives scores (0-100) across 6 dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Overall** | 100% | Composite score |
| **Technical Accuracy** | 30% | Correctness and depth |
| **Communication** | 15% | Clarity and structure |
| **Knowledge Depth** | 20% | Understanding level |
| **Problem Solving** | 15% | Analytical approach |
| **Role Relevance** | 20% | Job fit assessment |


## 🛡️ Security Features

- **JWT Authentication**: Secure token-based auth with configurable expiration
- **Password Hashing**: bcrypt with 12 rounds
- **Tab Switch Detection**: Automatic termination after 3 violations
- **Session Management**: Tracked and validated server-side
- **CORS Protection**: Configured for trusted origins only
- **SQL Injection Prevention**: TypeORM parameterized queries

---

## 🎯 Key Features Explained

### Real-Time Transcription
- Browser-native Speech Recognition API
- Live transcript display during recording
- Final server-side transcription via Groq Whisper

### Silence Detection
- Analyzes audio levels in real-time
- Auto-stops recording after 6 seconds of silence
- Minimum 2-second recording requirement

### Hint System
- Available only for **hard** difficulty questions
- Provides context without giving answers
- Includes example considerations

### Skills Tracking
- Maps questions to tested skills
- Identifies untested skills
- Generates skill-specific performance reports

---

## 🔧 Tech Stack

### Frontend
- **React 18** with TypeScript
- **React Router** for navigation
- **Vite** for blazing-fast builds
- **Web Speech API** for real-time transcription

### Backend
- **NestJS** framework
- **TypeORM** for database management
- **Passport JWT** for authentication
- **Class Validator** for input validation

### AI & ML
- **Groq API** (LLaMA 3.3 70B) for question generation & evaluation
- **OpenAI API** for text-to-speech
- **Whisper Large V3 Turbo** for speech-to-text

### Database
- **PostgreSQL 16** with JSONB support

### DevOps
- **Docker & Docker Compose** for containerization
- **GitHub Actions** ready for CI/CD

---

## 📈 Performance Metrics

- **Question Generation**: ~2-3 seconds
- **Audio Transcription**: ~1-2 seconds per 30s audio
- **AI Evaluation**: ~3-5 seconds (multi-agent)
- **TTS Generation**: ~1-2 seconds per question

---
# 🆕 New User Setup Guide

## Overview
When a new user registers, they need to complete their interview profile before starting an interview. This guide explains the setup process and database structure.

---

## 🗄️ Database Structure for New Users

### Automatic User Creation (Handled by Backend)
When a user registers through `/auth/register`, the system automatically:
1. Creates a `users` table entry with email and hashed password
2. Generates a UUID for the user
3. Returns a JWT token

### Interview Profile Setup Required
**New users must complete their profile before starting interviews.**

#### Manual Database Entry (For Testing/Admin)
If you need to manually create a profile for a user:

```sql
-- Replace these values with actual user data
INSERT INTO interview_profiles (
  user_id, 
  email, 
  role, 
  interview_type, 
  years_of_experience, 
  skills,
  total_questions
)
VALUES (
  'USER_UUID_HERE',           -- Get this from users table
  'user@example.com',          -- Must match user email
  'Software Engineer',         -- Job role
  'Technical',                 -- Interview type
  3.0,                         -- Years of experience
  ARRAY[                       -- Skills array
    'JavaScript',
    'React',
    'Node.js',
    'PostgreSQL',
    'System Design'
  ],
  5                            -- Number of questions (1-20)
);
```
#### Query to Find User UUID
```sql
SELECT id, email, created_at 
FROM users 
WHERE email = 'user@example.com';
```

---

## 🔗 Useful Links

- [Groq API Documentation](https://console.groq.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [React Documentation](https://react.dev)
