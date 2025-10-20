# API Documentation

REST API reference for the AI Interview Platform.

**Base URL:** `http://localhost:3000`  
**Auth:** All endpoints require JWT token in `Authorization: Bearer <token>` header

---

## Sessions

### Create Session

**POST** `/interview/sessions`

```json
{
  "role": "Software Engineer",
  "interviewType": "Technical",
  "yearsOfExperience": 3,
  "skills": ["JavaScript", "React", "Node.js"],
  "totalQuestions": 5
}
```

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| role | string | ✅ | - | Job title |
| interviewType | string | ✅ | - | Interview category |
| yearsOfExperience | number | ❌ | 0 | Experience level |
| skills | string[] | ❌ | [] | Skills to assess |
| totalQuestions | number | ❌ | 5 | 1-20 questions |

**Response:** `201 Created`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "role": "Software Engineer",
  "status": "pending",
  "currentQuestionIndex": 0,
  "totalQuestions": 5,
  "tabSwitches": 0,
  "createdAt": "2025-01-15T10:30:00Z"
}
```

---

### Start Session

**PATCH** `/interview/sessions/:id/start`

**Response:** `200 OK`

```json
{
  "sessionId": "550e8400-...",
  "status": "in_progress",
  "startedAt": "2025-01-15T10:35:00Z"
}
```

---

### Get Session

**GET** `/interview/sessions/:id`

**Response:** `200 OK`

```json
{
  "sessionId": "550e8400-...",
  "role": "Software Engineer",
  "status": "in_progress",
  "currentQuestionIndex": 2,
  "totalQuestions": 5,
  "tabSwitches": 0,
  "skills": ["JavaScript", "React"],
  "startedAt": "2025-01-15T10:35:00Z"
}
```

---

### Complete Session

**PATCH** `/interview/sessions/:id/complete`

**Response:** `200 OK`

```json
{
  "sessionId": "550e8400-...",
  "status": "completed",
  "completedAt": "2025-01-15T11:00:00Z"
}
```

---

## Questions

### Generate Next Question

**POST** `/interview/sessions/:id/next-question`

```json
{
  "yearsOfExperience": 3
}
```

**Response:** `200 OK`

```json
{
  "question": "Describe a time when you optimized a React application. What approach did you take?",
  "questionNumber": 3,
  "difficulty": "medium",
  "category": "behavioral",
  "audioBase64": "//NExAAQ...MP3_AUDIO_BASE64..."
}
```

**Categories (rotated):** behavioral, technical, situational, competency, problemSolving

---

### Get Hint

**POST** `/interview/sessions/:id/hint`

```json
{
  "questionNumber": 3
}
```

**Response:** `200 OK` _(only for hard questions)_

```json
{
  "hint": "This question asks you to demonstrate React performance optimization. Discuss specific tools, metrics, and measurable results.",
  "examples": [
    "Profiling tools (React DevTools, Chrome Performance)",
    "Techniques (memoization, code splitting)",
    "Results (load time improvements)"
  ]
}
```

**Errors:**
- `403` - Hints only for hard difficulty
- `404` - Question not found

---

## Answers

### Submit Answer

**POST** `/interview/sessions/:id/submit-answer`

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| audio | File | ✅ |
| questionNumber | string | ✅ |
| yearsOfExperience | string | ❌ |

**Example (curl):**

```bash
curl -X POST http://localhost:3000/interview/sessions/{id}/submit-answer \
  -H "Authorization: Bearer <token>" \
  -F "audio=@answer.webm" \
  -F "questionNumber=3" \
  -F "yearsOfExperience=3"
```

**Response:** `200 OK`

```json
{
  "transcript": "In my previous role, I noticed our React dashboard took 3 seconds to load. I used React DevTools Profiler to identify unnecessary re-renders...",
  "evaluation": {
    "overallScore": 87,
    "technicalAccuracy": 90,
    "communicationClarity": 88,
    "depthOfKnowledge": 85,
    "problemSolvingApproach": 88,
    "relevanceToRole": 86,
    "feedback": "Excellent answer! Strong technical knowledge with specific examples.",
    "strengths": [
      "Used profiling tools effectively",
      "Provided measurable results",
      "Clear problem-solving process"
    ],
    "improvements": [
      "Could mention team collaboration",
      "Discuss long-term maintenance"
    ],
    "keyInsights": [
      "Demonstrated data-driven optimization approach",
      "Strong understanding of React performance patterns"
    ],
    "wordCount": 142,
    "confidence": "high",
    "redFlags": [],
    "followUpQuestions": [
      "How did you communicate these changes to the team?",
      "What metrics do you use for ongoing monitoring?"
    ]
  }
}
```

---

## Audio

### Transcribe Audio Chunk

Real-time transcription for live feedback.

**POST** `/interview/transcribe-chunk`

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| audio | File | ✅ |
| previousContext | string | ❌ |

**Response:** `200 OK`

```json
{
  "text": "In my previous role at TechCorp",
  "timestamp": "2025-01-15T10:45:30Z"
}
```

---

### Text-to-Speech

Convert text to audio.

**POST** `/interview/tts`

```json
{
  "text": "What are the trade-offs between REST and GraphQL?"
}
```

**Response:** `200 OK`

Returns MP3 audio as `StreamableFile`

**Headers:**
- `Content-Type: audio/mp3`
- `Content-Length: <bytes>`

---

## Results

### Get Session Q&A

**GET** `/interview/sessions/:id/qa`

**Response:** `200 OK`

```json
[
  {
    "qaId": "abc123...",
    "sessionId": "550e8400-...",
    "questionNumber": 1,
    "question": "Tell me about your background as a Software Engineer.",
    "questionCategory": "behavioral",
    "difficulty": "easy",
    "testedSkills": ["Communication"],
    "answer": "I've been working as a software engineer for 3 years...",
    "overallScore": 78,
    "technicalAccuracy": 75,
    "feedback": "Good answer with solid foundations...",
    "strengths": ["Clear communication", "Relevant experience"],
    "improvements": ["Add more technical depth"],
    "createdAt": "2025-01-15T10:36:00Z"
  }
]
```

---

### Get Session Results

Comprehensive analytics and performance summary.

**GET** `/interview/sessions/:id/results`

**Response:** `200 OK`

```json
{
  "session": {
    "sessionId": "550e8400-...",
    "userId": "123e4567-...",
    "userEmail": "candidate@example.com",
    "role": "Software Engineer",
    "interviewType": "Technical",
    "status": "completed",
    "totalQuestions": 5,
    "allSkills": ["JavaScript", "React", "Node.js"]
  },
  "questions": [
    {
      "questionId": "abc123...",
      "questionNumber": 1,
      "questionCategory": "behavioral",
      "difficulty": "easy",
      "question": "Tell me about...",
      "testedSkills": ["Communication"],
      "answer": "I've been...",
      "scores": {
        "overall": 78,
        "technical": 75,
        "communication": 82,
        "depth": 72,
        "problemSolving": 76,
        "roleRelevance": 80
      },
      "feedback": "Good answer...",
      "strengths": ["Clear communication"],
      "improvements": ["Add technical depth"],
      "wordCount": 145,
      "confidence": "medium"
    }
  ],
  "summary": {
    "overallPerformance": {
      "averageScore": 82,
      "grade": "Good",
      "totalAnswered": 5,
      "totalQuestions": 5
    },
    "skillPerformance": [
      {
        "skill": "React",
        "averageScore": 88,
        "timesTested": 3,
        "questionNumbers": [2, 3, 5],
        "performance": "excellent"
      },
      {
        "skill": "JavaScript",
        "averageScore": 79,
        "timesTested": 4,
        "questionNumbers": [1, 2, 4, 5],
        "performance": "good"
      }
    ],
    "difficultyBreakdown": [
      {
        "difficulty": "easy",
        "averageScore": 75,
        "questionsAsked": 1
      },
      {
        "difficulty": "medium",
        "averageScore": 83,
        "questionsAsked": 3
      },
      {
        "difficulty": "hard",
        "averageScore": 85,
        "questionsAsked": 1
      }
    ],
    "untestedSkills": ["Node.js"]
  }
}
```

**Performance Levels:**
- `excellent` - Score ≥ 85
- `good` - Score ≥ 70
- `satisfactory` - Score ≥ 55
- `needs improvement` - Score < 55

---

## Monitoring

### Record Tab Switch

Tracks focus loss for anti-cheating.

**POST** `/interview/sessions/:id/tab-switch`

**Response:** `200 OK`

```json
{
  "tabSwitches": 1,
  "shouldTerminate": false,
  "remainingWarnings": 2,
  "message": "First warning: Please stay on this tab"
}
```

**Termination:** After 3 switches, session status → `cancelled`

---

## Error Responses

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Hint not available for difficulty |
| 404 | Not Found - Session/question not found |
| 500 | Internal Server Error |

**Error Format:**

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

---

## Audio Formats

**Supported:** WebM, MP3, WAV  
**Max Size:** 25 MB  
**Recommended:** WebM for browser recording

---

## Rate Limits

- **Groq (Free):** 30 req/min, 14,400 req/day
- **OpenAI TTS:** 3 req/min (Tier 1)

Implement exponential backoff for production.

---

## Quick Examples

### Complete Interview Flow

```bash
# 1. Create session
SESSION_ID=$(curl -X POST /interview/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"Engineer","interviewType":"Technical","totalQuestions":5}' \
  | jq -r '.sessionId')

# 2. Start session
curl -X PATCH /interview/sessions/$SESSION_ID/start \
  -H "Authorization: Bearer $TOKEN"

# 3. Get first question
curl -X POST /interview/sessions/$SESSION_ID/next-question \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"yearsOfExperience":3}'

# 4. Submit answer
curl -X POST /interview/sessions/$SESSION_ID/submit-answer \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@answer.webm" \
  -F "questionNumber=1"

# 5. Get results
curl /interview/sessions/$SESSION_ID/results \
  -H "Authorization: Bearer $TOKEN"
```

---

## Notes

- All timestamps in ISO 8601 format (UTC)
- UUIDs for session/user/question IDs
- Scores range 0-100
- Audio returned as base64 in JSON responses