# 🎤 AI-Powered Voice Interview Platform

A full-stack voice-based interview system with real-time speech recognition, AI-powered evaluation, and comprehensive performance analytics.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#️-architecture)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Tech Stack](#-tech-stack)
- [Security](#️-security)
- [Interview Flow](#-interview-flow)
- [Resources](#-resources)

---

## 🌟 Features

### Interview Experience
- **🎙️ Real-Time Voice Recording** - Browser-native speech recognition with live transcription
- **🤖 AI Question Generation** - Dynamic, role and experience level specific questions using LLaMA 3.3 70B. With good diversity between Interview categories and difficulty levels. The skills fed by the recruiters are used to prepare the questions as well.
- **🔊 Natural Voice Prompts** - Text-to-speech with OpenAI's voice synthesis
- **💡 Smart Hints** - Context-aware guidance for challenging (hard-level) questions. If the evaluation agent evaluates the difficulty level of a question as hard, hint is displayed for the user and is logged if the user clicks on it.
- **📊 Multi-Agent Evaluation** - Technical, communication, and role-specific assessments

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
cp .env.example .env
# Edit .env with your API keys (see below)

# Configure frontend environment
cd ../frontend
cp .env.example .env

# Start all services
cd ..
docker-compose up -d

# Access the application
# Frontend: http://localhost:5173
# Backend:  http://localhost:4000
# Database: localhost:5432
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
2. **Complete your profile** - role, skills, experience level
3. **Start your first interview** with 5 sample questions

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
- **GitHub Actions** - CI/CD pipeline ready

---

## 🛡️ Security

- **JWT Authentication** - Token-based auth with configurable expiration
- **Password Hashing** - bcrypt with 12 salt rounds
- **Tab Switch Detection** - Monitors focus with 3-strike policy
- **Session Validation** - Server-side session integrity checks
- **CORS Protection** - Restricted to trusted origins
- **SQL Injection Prevention** - Parameterized queries via TypeORM
- **Input Validation** - Class-validator on all endpoints

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