# 🎤 AI-Powered Voice Interview Platform

A full-stack voice-based interview system with real-time speech recognition, AI-powered evaluation, and comprehensive performance analytics.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#️-architecture)
- [Quick Start](#-quick-start)
- [Documentation (AI SDK, API, Database Schema)](#-documentation)
- [Tech Stack](#-tech-stack)
- [Security](#️-security)
- [Interview Flow](#-interview-flow)
- [Resources](#-resources)

---

## 🌟 Features

## Login and Register
- **Recruiter** - Recruiters can make their own account or login once they register. Once Registered they are taken to the Create Profile for Candidates page where they can make Interview profiles for candidates to review and add skills required for the role they want the candidate to interview for. They can also view the profiles for candidates that they have generated. An interview profile contains details like the Candidate Email, Company Name, Role, Interview Type, Years of Experience, Required Skill, Total Questions (1-20) for the Interview.

- **Candidate** - Candidate can make their own account and login once they register. If a Interview profile for candidate is not made by Recruiter, they get a Warning asking to check with the Recruiter. If the Interview Profile exists, and once the candidate logs in they are taken to Interview Home page to review their qualifications and browser settings. Once confirmed, they are taken to the Interview Page to Interview.


### Interview Experience
- **🎙️ Real-Time Voice Recording** - Browser-native speech recognition with live transcription
- **🤖 AI Question Generation** - Dynamic, role and experience level specific questions using LLaMA 3.3 70B. With good diversity between Interview categories and difficulty levels. The skills fed by the recruiters are used to prepare the questions as well.
- **🔊 Natural Voice Prompts** - Text-to-speech with OpenAI's voice synthesis
- **💡 Smart Hints** - Context-aware guidance for challenging (hard-level) questions. If the evaluation agent evaluates the difficulty level of a question as hard, hint is displayed for the user and is logged if the user clicks on it.
- **📊 Multi-Agent Evaluation** - Technical, communication, and role-specific assessments
- **🚨 Anti-Cheating System** - Tab switch detection with 3-strike termination

### Intelligence & Analysis
- **Adaptive Difficulty** - Questions scaled to experience level (easy/medium/hard)
- **Skills Tracking** - Monitors which competencies are tested across questions
- **Comprehensive Scoring** - 6-dimensional evaluation per answer:
  - Overall Score
  - Technical Accuracy
  - Communication Clarity
  - Depth of Knowledge
  - Problem-Solving Approach
  - Role Relevance
- **Detailed Analytics** - Performance breakdowns with skill-specific insights

### Security & Integrity
- **JWT Authentication** - Secure token-based auth with bcrypt password hashing
- **Anti-Cheating System** - Tab switch detection with 3-strike termination
- **Session Management** - Server-side validation with PostgreSQL persistence
- **Protected Routes** - Role-based access control

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Login/     │  │   Profile    │  │   Voice      │           │
│  │   Register   │→ │   Setup      │→ │   Interview  │→ Results  │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ REST API + JWT
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (NestJS + TypeORM)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │     Auth     │  │   Profile    │  │   Interview  │           │
│  │   Service    │  │   Service    │  │   Service    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                              ↓                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  AI Service  │  │   STT/TTS    │  │  Multi-Agent │           │
│  │  (Groq)      │  │   (OpenAI)   │  │  Evaluator   │           │
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
- **Docker & Docker Compose** (optional but recommended)
- **API Keys**:
  - [Groq API key](https://console.groq.com) - For AI question generation & transcription
  - [OpenAI API key](https://platform.openai.com) - For text-to-speech

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/mitali-p42/Interview-Agent.git
cd ai-interview-platform

# Configure backend environment
cd backend
# Edit .env with your API keys (see below)

# Start all services
cd ..
docker-compose up -d

# (Optional) Check running containers
docker ps

# (Optional)Check logs of any service (use the container name or ID)
docker logs <container_id_or_name>

# Access the application
# Frontend: http://localhost:5173
# Backend:  http://localhost:4000
# Database: localhost:5432

# Shut down all services once tested
docker-compose down -v
```
### Environment Configuration

**backend/.env**
```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/jwt_auth_starter

# Authentication
JWT_SECRET=your_secure_random_string_here
JWT_EXPIRES_IN=1d

# Server
PORT=4000

# AI Services (Required)
GROQ_API_KEY=gsk_your_groq_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here
```

**frontend/.env**
```env
VITE_API_BASE=http://localhost:4000
```

### First Time Setup

1. **Register a new account** at `http://localhost:5173/register`
2. **If Recruiter, create candidate profile** - role, skills, experience level,  interview type
3. **If Candidate, review qualifications** - role, experience level, interview type, mic settings, browser compatibility
3. **Start your first interview** with 5 sample questions by default. Manually trigger stop recording or be silent for 6 seconds.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[API Reference](./docs/API.md)** | Complete REST API documentation with examples |
| **[AI Configuration](./docs/AI_SDK.md)** | Groq & OpenAI setup, models, and optimization |
| **[Database Schema](./docs/DATABASE.md)** | Schema design and query examples |

### Key Concepts

- **[Multi-Agent Evaluation](./docs/AI_SDK.md#multi-agent-evaluation)** - How three specialized AI agents score answers
- **[Question Generation Agent](./docs/AI_SDK.md#question-generation)** - Adaptive difficulty and skill targeting
- **[Session Management](./docs/API.md#sessions)** - Creating and tracking interview sessions
- **[Results Analysis](./docs/API.md#get-session-results)** - Understanding performance metrics

---

## 🔧 Tech Stack

### Frontend
- **React 18** with TypeScript - Modern UI with type safety
- **React Router** - Client-side routing
- **Vite** - Lightning-fast development builds
- **Web Speech API** - Real-time browser transcription

### Backend
- **NestJS** - Scalable Node.js framework
- **TypeORM** - Type-safe database operations
- **Passport JWT** - Secure authentication
- **Class Validator** - Request validation

### AI & ML
- **Groq API** - LLaMA 3.3 70B for question generation & evaluation
- **Whisper Large V3 Turbo STT** - Fast, accurate speech-to-text
- **OpenAI TTS** - Natural voice synthesis

### Database
- **PostgreSQL 16** - Robust relational database with JSONB support

### DevOps
- **Docker & Docker Compose** - Containerized deployment
---

## 🛡️ Security

- **JWT Authentication** - Token-based auth with configurable expiration
- **Password Hashing** - bcrypt with 12 salt rounds
- **Tab Switch Detection** - Monitors focus with 3-strike policy
- **Session Validation** - Server-side session integrity checks
- **SQL Injection Prevention** - Parameterized queries via TypeORM

---

## 🎯 Interview Flow

1. **Profile Setup** → Enter role, skills, and experience
2. **Session Creation** → Configure number of questions (1-20)
3. **Question Loop** (for each question):
   - AI generates adaptive question
   - TTS reads question aloud
   - Record voice answer
   - Real-time transcription feedback
   - Multi-agent evaluation
4. **Results Dashboard** → Comprehensive analytics and feedback

---

## 🔗 Resources

- [Groq Documentation](https://console.groq.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [TypeORM Guide](https://typeorm.io)

---
