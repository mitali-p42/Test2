# AI SDK Configuration Guide

Complete configuration and usage guide for AI services in the interview platform.

---

## Table of Contents

- [Overview](#overview)
- [SDK Setup](#sdk-setup)
- [Question Generation](#question-generation)
- [Multi-Agent Evaluation](#multi-agent-evaluation)
- [Hint Generation](#hint-generation)
- [Audio Services](#audio-services)
- [Error Handling](#error-handling)
- [Rate Limits & Costs](#rate-limits--costs)
- [Configuration Summary](#configuration-summary)

---

## Overview

Two AI providers power the interview platform:

| Provider | Purpose | Models Used |
|----------|---------|-------------|
| **Groq** | Question generation, answer evaluation, transcription | LLaMA 3.3 70B Versatile, Whisper V3 Turbo |
| **OpenAI** | Text-to-speech | TTS-1 |

---

## SDK Setup

### Groq SDK

**Installation:**
```bash
npm install groq-sdk
```

**API Key Configuration:**

1. Sign up at [console.groq.com](https://console.groq.com)
2. Navigate to **API Keys** section
3. Create and copy API key (starts with `gsk_`)
4. Add to `backend/.env`:

```env
GROQ_API_KEY=gsk_your_api_key_here
```

**Service Initialization:**
```typescript
import Groq from 'groq-sdk';
import { ConfigService } from '@nestjs/config';

export class AIService {
  private groq: Groq;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get('GROQ_API_KEY');
    if (!apiKey) console.warn('⚠️  GROQ_API_KEY not configured');
    this.groq = new Groq({ apiKey: apiKey || 'dummy' });
  }
}
```

**Available Models:**

| Model | Identifier | Specs | Use Case |
|-------|-----------|-------|----------|
| LLaMA 3.3 70B Versatile | `llama-3.3-70b-versatile` | 128K context, 60-120 tok/s | Question generation, evaluation |
| Whisper Large V3 Turbo | `whisper-large-v3-turbo` | 8x real-time, 99 languages | Speech-to-text transcription |

### OpenAI SDK

**Installation:**
```bash
npm install openai
```

**API Key Configuration:**
```env
OPENAI_API_KEY=sk-your_api_key_here
```

**Service Initialization:**
```typescript
import OpenAI from 'openai';

export class AIService {
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (!apiKey) console.warn('⚠️  OPENAI_API_KEY not configured');
    this.openai = new OpenAI({ apiKey: apiKey || 'dummy' });
  }
}
```

**Text-to-Speech Configuration:**
- **Model:** `tts-1` (standard quality)
- **Voice:** `alloy` (natural, professional)
- **Speed:** `1.0` (normal pace)
- **Max input:** 4,096 characters
- **Cost:** $15 per 1M characters

---

## Question Generation

### Generation Strategy

Questions are dynamically generated using multiple contextual factors to ensure personalized, comprehensive assessment:

#### 1. Experience-Based Difficulty Progression

Difficulty automatically scales with candidate experience:

| Experience Level | Question 1 | Questions 2-3 | Questions 4-5 |
|-----------------|-----------|---------------|---------------|
| **0-2 years (Junior)** | Easy | Easy-Medium | Medium |
| **2-5 years (Mid-level)** | Easy | Medium | Hard |
| **5+ years (Senior)** | Medium | Hard | Hard |

**Logic:**
```typescript
if (experience < 2) {
  targetDifficulty = questionNumber <= 2 ? 'easy' : 'medium';
} else if (experience < 5) {
  targetDifficulty = questionNumber <= 1 ? 'easy' 
                   : questionNumber <= 3 ? 'medium' 
                   : 'hard';
} else {
  targetDifficulty = questionNumber <= 1 ? 'medium' : 'hard';
}
```

#### 2. Category Rotation (Round-Robin)

Five categories cycle to ensure balanced assessment:

1. **Behavioral** - Past experiences, decision-making, team dynamics
2. **Technical** - Domain expertise, technical knowledge, implementation
3. **Situational** - Hypothetical scenarios, judgment calls, adaptability
4. **Competency** - Core skills, methodologies, best practices
5. **Problem-Solving** - Analytical thinking, systematic approaches, debugging

**Example Sequence:**
```
Q1: Behavioral → Q2: Technical → Q3: Situational → Q4: Competency → Q5: Problem-Solving
```

#### 3. Skills Testing

Questions target specific skills from candidate profile:

```typescript
CANDIDATE SKILLS: React, Node.js, TypeScript, PostgreSQL, AWS
- Focus questions on testing these specific skills
- Ask about practical application
- Ensure comprehensive coverage across interview
```

**Skill Extraction:**
After generation, system extracts which skills were tested by matching keywords in the question text.

#### 4. Role-Specific Tailoring

Questions adapt to the specific role (e.g., Frontend Developer, DevOps Engineer, Data Scientist):
- Technical depth aligned with position
- Category focus adjusted for role type
- Terminology and context specific to domain

#### 5. Interview Type Adaptation

- **Technical:** Deep technical probes, implementation details
- **Behavioral:** Past experiences, soft skills, team dynamics  
- **Mixed:** Balanced combination of technical and behavioral

### Difficulty Definitions

| Level | Characteristics | Target Audience |
|-------|----------------|-----------------|
| **Easy** | Basic concepts, straightforward scenarios, fundamental knowledge | 0-2 years experience |
| **Medium** | Moderate complexity, critical thinking, real-world application, trade-off awareness | 2-5 years experience |
| **Hard** | Complex scenarios, deep expertise, strategic thinking, architecture-level decisions | 5+ years experience |

### Generation Process (5 Steps)

#### Step 1: Context Determination
```typescript
const category = categories[(questionNumber - 1) % 5]; // Round-robin
const targetDifficulty = calculateDifficulty(experience, questionNumber);
const starter = getRandomStarter(category); // e.g., "Tell me about a time when"
```

#### Step 2: Prompt Construction
```typescript
const prompt = `You are conducting a ${interviewType} interview for a ${role}.

CANDIDATE PROFILE:
- Experience: ${yearsOfExperience} years
- Role: ${role}
- Type: ${interviewType}

SKILLS: ${skills.join(', ')}
- Test these skills practically
- Cover different skills across questions

QUESTION ${questionNumber}:
📋 Category: ${category}
🎚️ Difficulty: ${targetDifficulty}
🎯 Must test: ${skills.slice(0, 3).join(', ')}

GUIDELINES:
- EASY: Basic concepts, straightforward scenarios
- MEDIUM: Moderate complexity, real-world application
- HARD: Complex scenarios, deep expertise, trade-offs

Generate ONE focused question (40-60 words):`;
```

#### Step 3: AI Generation with High Temperature
```typescript
const completion = await this.groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: 'Expert interviewer...' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.85,  // High creativity for diversity
  max_tokens: 180,    // Concise questions (40-60 words)
});
```

**Why High Temperature (0.85)?**
- Prevents repetitive questions across interviews
- Ensures unique phrasing and approaches
- Maintains diversity while staying relevant

#### Step 4: Difficulty Verification (Quality Control)

Separate AI call validates the generated question matches target difficulty:

```typescript
const verifiedDifficulty = await this.verifyQuestionDifficulty(
  question, role, yearsOfExperience, targetDifficulty
);
```

**Verification Prompt:**
```typescript
"Analyze this question and determine its difficulty level.
QUESTION: ${question}
ROLE: ${role}
EXPERIENCE: ${yearsOfExperience} years
TARGET: ${targetDifficulty}

Criteria:
- EASY: Basic concepts, straightforward recall (0-2 years)
- MEDIUM: Analytical thinking, real-world application (2-5 years)  
- HARD: Deep expertise, strategic trade-offs (5+ years)

Return JSON: { difficulty: 'easy'|'medium'|'hard', reasoning: '...' }"
```

**Configuration:**
- Temperature: `0.2` (deterministic)
- Max tokens: `200` (brief analysis)
- Response format: `json_object`

This prevents difficulty drift and ensures consistency.

#### Step 5: Skill Extraction
```typescript
const testedSkills = this.extractTestedSkills(question, skills);
```

Matches skill keywords in question text. Falls back to random skills if no matches found (for UI display).

### Question Diversity Mechanisms

1. **High Temperature (0.85)** - Ensures varied phrasing and approaches
2. **Category Rotation** - Prevents clustering of similar question types
3. **Skills Rotation** - Varies which skills are tested each question
4. **Random Starters** - Different question opening patterns per category
5. **Top-p Sampling (0.9)** - Additional diversity in token selection

### Fallback Questions

If AI generation fails, pre-defined questions ensure interview continuity:

```typescript
const fallbacks = {
  technical: `Walk me through your approach to solving complex technical problems in your ${role} work.`,
  behavioral: `Tell me about a time when you had to make a difficult decision as a ${role}.`,
  situational: `Imagine your team is behind schedule. As a ${role}, how would you handle this?`,
  competency: `Describe your methodology for ${role}-related decision making.`,
  problemSolving: `You're given a poorly performing system. Walk me through your diagnostic process.`,
};
```

---

## Multi Agent Evaluation

Three specialized AI agents independently evaluate each answer, then results are synthesized into a comprehensive score.

### Agent Architecture

```
                Answer → Transcription
                         ↓
              ┌──────────┴──────────┐
              │                     │
        Technical            Communication        Role-Specific
        Agent                Agent                Agent
        (30-35%)            (15%)                (20%)
              │                     │                     │
              └──────────┬──────────┘                     │
                         ↓                                │
                  Synthesis Engine ←──────────────────────┘
                         ↓
                  Final Evaluation
```

### Agent 1: Technical Agent (50% Weight)

**Focus:** Technical accuracy, depth, problem-solving

**Configuration:**
- Temperature: `0.2` (consistent scoring)
- Max tokens: `600` (detailed analysis)
- Response format: `json_object`

**Evaluates:**
```typescript
{
  technicalAccuracy: 0-100,      // 30% of final score
  depthOfKnowledge: 0-100,       // 20% of final score  
  problemSolvingApproach: 0-100, // 15% of final score
  technicalStrengths: string[],
  technicalGaps: string[],
  redFlags: string[]
}
```

**Automatic Penalties:**

| Condition | Penalty | Reason |
|-----------|---------|--------|
| < 30 words (Junior) | Cap technical scores at 40 | Insufficient detail for experience level |
| < 50 words (Mid-level) | Cap technical scores at 40 | Below expected depth |
| < 80 words (Senior) | Cap technical scores at 40 | Inadequate senior-level response |
| Generic answers ("yes", "okay") | Cap all scores at 10-15 | No meaningful content |

**Red Flags Detection:**
- Technical misconceptions or errors
- Incomplete understanding of concepts
- Lack of practical experience indicators
- Answer too brief for experience level

### Agent 2: Communication Agent (15% Weight)

**Focus:** Clarity, structure, conciseness

**Configuration:**
- Temperature: `0.2` (consistent scoring)
- Max tokens: `400` (focused feedback)
- Response format: `json_object`

**Evaluates:**
```typescript
{
  communicationClarity: 0-100,   // 15% of final score
  structureScore: 0-100,         // Not directly weighted
  conciseness: 0-100,            // Not directly weighted
  communicationStrengths: string[],
  communicationImprovements: string[]
}
```

**Penalties:**
- Answers < 20 words: Cap at 40 clarity, 35 structure, 30 conciseness
- Disorganized responses: Lower structure score
- Overly verbose answers: Lower conciseness score

### Agent 3: Role-Specific Agent (20% Weight)

**Focus:** Relevance to role, experience alignment

**Configuration:**
- Temperature: `0.3` (slight variation for insights)
- Max tokens: `600` (insights + follow-ups)
- Response format: `json_object`

**Evaluates:**
```typescript
{
  relevanceToRole: 0-100,              // 20% of final score
  experienceLevelAlignment: 0-100,     // Not directly weighted
  roleSpecificInsights: string[],
  missingCompetencies: string[],
  followUpQuestions: string[]          // For interviewer guidance
}
```

**Penalties:**
- Answers < 30 words: Cap at 40 relevance, 35 alignment
- Off-topic responses: Lower relevance score
- Misaligned experience: Lower alignment score

**Follow-up Questions:**
Generates 1-3 probing questions for interviewer to dig deeper into candidate's response.

### Synthesis Engine

Combines all three agent evaluations into final score and feedback.

#### Weighted Scoring Formula

```typescript
rawScore = 
  (technicalAccuracy × 0.30) +           // 30% - Technical correctness
  (depthOfKnowledge × 0.20) +            // 20% - Subject depth
  (problemSolvingApproach × 0.15) +      // 15% - Methodology
  (communicationClarity × 0.15) +        // 15% - Clarity
  (relevanceToRole × 0.20)               // 20% - Role fit
```

#### Global Penalties

Applied after weighted calculation to prevent score inflation:

| Condition | Score Cap | Reason |
|-----------|-----------|--------|
| < 10 words | 15 | Extremely brief, no substance |
| < 20 words | 35 | Very brief, insufficient |
| < 40 words | 55 | Needs significantly more detail |
| Generic answer ("yes", "okay") | 10 | No meaningful content |
| 2+ subscores < 40 | 45 | Multiple weak dimensions |

#### Confidence Calculation

```typescript
scoreVariance = max(allScores) - min(allScores);

if (wordCount < 15 || score < 35 || variance > 40) {
  confidence = 'low';       // Inconsistent or inadequate
} else if (wordCount > 80 && score > 75 && variance < 20) {
  confidence = 'high';      // Strong, consistent performance
} else {
  confidence = 'medium';    // Adequate response
}
```

**Confidence Factors:**
- **Word count:** Sufficient detail for evaluation
- **Score:** Overall performance level
- **Variance:** Agreement between agents (low variance = high confidence)

#### Final Output Structure

```typescript
{
  overallScore: 85,
  technicalAccuracy: 88,
  communicationClarity: 82,
  depthOfKnowledge: 85,
  problemSolvingApproach: 87,
  relevanceToRole: 83,
  feedback: "Excellent answer! You demonstrated...",
  strengths: [
    "Specific performance metrics provided",
    "Multiple optimization techniques mentioned"
  ],
  improvements: [
    "Could elaborate on the code splitting strategy",
    "Mention team collaboration aspects"
  ],
  keyInsights: [
    "Strong focus on measurable outcomes",
    "Practical experience with modern React"
  ],
  wordCount: 42,
  confidence: "high",
  redFlags: [],
  followUpQuestions: [
    "How did you measure these improvements?",
    "What trade-offs did you encounter?"
  ]
}
```

### Fallback Evaluation

If all agents fail, conservative defaults ensure interview continuity:

```typescript
{
  overallScore: 70,
  technicalAccuracy: 70,
  communicationClarity: 75,
  depthOfKnowledge: 65,
  problemSolvingApproach: 70,
  relevanceToRole: 70,
  feedback: 'Answer received. More detail would strengthen your response.',
  confidence: 'medium'
}
```

**Fallback Triggers:**
- Groq API failure (rate limit, timeout)
- JSON parsing errors (all fallback attempts exhausted)
- Network issues or service outages

---

## Hint Generation

Hints are **only available for hard difficulty questions** to assist candidates without revealing answers.

### Purpose

- Clarify what the question is asking
- Explain key concepts or terminology
- Suggest aspects to consider
- **Never** provide actual answers or specific solutions

### Implementation

**Configuration:**
- Model: `llama-3.3-70b-versatile`
- Temperature: `0.3` (balanced clarity)
- Max tokens: `400` (short guidance)
- Response format: `json_object`

**Prompt Structure:**
```typescript
`You are helping a candidate understand a question WITHOUT giving the answer.

QUESTION: ${question}
ROLE: ${role}
INTERVIEW TYPE: ${interviewType}

Provide a CONCISE hint that:
1. Clarifies what the question asks (1-2 sentences)
2. Explains key concepts or terminology
3. Suggests aspects to consider
4. Does NOT provide the actual answer

Return JSON:
{
  "hint": "Concise explanation (2-3 sentences)",
  "examples": ["Example type 1", "Example type 2"]
}`
```

**Response Example:**
```json
{
  "hint": "This question asks you to evaluate trade-offs between two architectural approaches. Consider factors like scalability, maintainability, and team size when formulating your answer.",
  "examples": [
    "Development speed vs. long-term maintenance",
    "Resource requirements and infrastructure costs",
    "Team expertise and learning curve"
  ]
}
```

### Access Control

```typescript
// Only hard questions can request hints
if (qa.difficulty !== 'hard') {
  throw new BadRequestException('Hints only available for hard questions');
}

return this.aiService.generateQuestionHint(
  qa.question, 
  session.role, 
  session.interviewType
);
```

**Rationale:**
- Easy questions: Straightforward, hints unnecessary
- Medium questions: Moderate complexity, should be answerable
- Hard questions: Complex scenarios where guidance is valuable

### Fallback Hint

If generation fails:
```json
{
  "hint": "Think about: What is this question trying to evaluate? What specific experiences or knowledge would demonstrate your capability?",
  "examples": [
    "Relevant past work",
    "Problem-solving methods",
    "Results achieved"
  ]
}
```

---

## Audio Services

### Speech-to-Text (Groq Whisper V3 Turbo)

**Performance Characteristics:**
- **Speed:** 8x faster than real-time
- **Latency:** ~1-2 seconds for 30-second audio
- **Accuracy:** 95%+ for clear English speech
- **Languages:** 99 languages (auto-detect available)
- **Max file size:** 25 MB

**Configuration:**
```typescript
{
  model: 'whisper-large-v3-turbo',
  language: 'en',
  response_format: 'text',
  temperature: 0.0  // Deterministic for live transcription
}
```

**Usage Pattern:**
```typescript
// Write to temp file (avoids memory bloat)
const tempPath = path.join('/tmp', filename);
fs.writeFileSync(tempPath, audioBuffer);

// Transcribe
const transcription = await this.groq.audio.transcriptions.create({
  file: fs.createReadStream(tempPath),
  model: 'whisper-large-v3-turbo',
  language: 'en',
  response_format: 'text',
});

// Cleanup
fs.unlinkSync(tempPath);

return typeof transcription === 'string' 
  ? transcription 
  : transcription.text || '';
```

**Real-time Chunk Transcription:**

For live transcription during recording:
```typescript
async transcribeAudioChunk(
  audioChunk: Buffer, 
  previousContext: string = ''
): Promise<{ text: string; confidence?: number }>
```

Returns partial transcription for real-time display to candidate.

### Text-to-Speech (OpenAI TTS-1)

**Performance Characteristics:**
- **Latency:** ~500ms for short questions (40-60 words)
- **Quality:** Natural, professional voice
- **Cost:** $15 per 1M characters (~$0.0075 per 5-question interview)
- **Voice:** Alloy (neutral, professional tone)

**Configuration:**
```typescript
{
  model: 'tts-1',
  voice: 'alloy',
  speed: 1.0
}
```

**Usage Pattern:**
```typescript
const mp3 = await this.openai.audio.speech.create({
  model: 'tts-1',
  voice: 'alloy',
  input: questionText,
  speed: 1.0,
});

// Convert to Buffer for API response
const buffer = Buffer.from(await mp3.arrayBuffer());

// Encode as Base64 for frontend
const audioBase64 = buffer.toString('base64');

// Frontend plays via:
const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
await audio.play();
```

---

## Error Handling

### Safe JSON Parsing

All LLM responses use multi-strategy fallback parsing:

```typescript
private safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // Strategy 1: Extract from markdown block
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    
    // Strategy 2: Extract raw JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    
    // Strategy 3: Direct parse
    return JSON.parse(text);
  } catch (error) {
    console.error('❌ JSON parse failed, using fallback');
    return fallback;
  }
}
```

**Why Multiple Strategies?**
- LLMs sometimes wrap JSON in markdown blocks
- May include explanatory text before/after JSON
- Ensures robust parsing even with unexpected formats

### Groq Error Handling

**Common Errors:**

| Status | Error | Solution |
|--------|-------|----------|
| `429` | Rate limit exceeded | Wait 60s, inform user to retry |
| `500` | Internal server error | Use fallback evaluation |
| `400` | Invalid request | Check JSON format, token limits |
| `401` | Invalid API key | Verify `GROQ_API_KEY` in `.env` |

**Example Handler:**
```typescript
try {
  return await this.groq.chat.completions.create({...});
} catch (error) {
  if (error.status === 429) {
    throw new Error('AI service rate limit. Retry in 60s.');
  } else if (error.status === 500) {
    return this.getFallbackResponse();
  }
  throw error;
}
```

### OpenAI Error Handling

**Common Errors:**

| Status/Code | Error | Solution |
|-------------|-------|----------|
| `429` | Rate limit | Wait and inform user |
| `400` | Invalid input | Check text length < 4096 chars |
| `401` | Invalid API key | Verify `OPENAI_API_KEY` |
| `insufficient_quota` | No credits | Add billing to account |

### Agent-Specific Fallbacks

Each agent returns safe defaults if evaluation fails:

**Technical Agent:**
```typescript
{
  technicalAccuracy: 35,
  depthOfKnowledge: 30,
  problemSolvingApproach: 30,
  technicalStrengths: [],
  technicalGaps: ['Evaluation failed'],
  redFlags: ['Technical assessment error']
}
```

**Communication Agent:**
```typescript
{
  communicationClarity: 50,
  structureScore: 45,
  conciseness: 45,
  communicationStrengths: [],
  communicationImprovements: ['Evaluation failed']
}
```

**Role-Specific Agent:**
```typescript
{
  relevanceToRole: 50,
  experienceLevelAlignment: 45,
  roleSpecificInsights: [],
  missingCompetencies: ['Evaluation failed'],
  followUpQuestions: []
}
```

---

## Rate Limits & Costs

### Groq Free Tier Limits

| Resource | Limit | Window |
|----------|-------|--------|
| **Requests** | 30 | Per minute |
| **Tokens** | 6,000 | Per minute |
| **Daily Requests** | 14,400 | Per day |

**Typical 5-Question Interview Usage:**
- Question generation: 5 requests × 300 tokens = **1,500 tokens**
- Answer evaluation: 5 requests × 1,000 tokens = **5,000 tokens**
- Audio transcription: 5 requests × 200 tokens = **1,000 tokens**
- **Total:** ~**7,500 tokens per interview**

### OpenAI Pricing

| Service | Cost | Notes |
|---------|------|-------|
| **TTS-1** | $15.00 / 1M chars | Standard quality (used) |
| **TTS-1-HD** | $30.00 / 1M chars | High definition (not used) |

**Cost Per Interview:**
- Average question: 100 characters
- 5 questions: 500 characters
- **Cost:** $0.0075 (less than 1 cent per interview)

**OpenAI Rate Limits (Tier 1):**
- 3 requests per minute
- 200,000 characters per day

### Platform Rate Limits

Additional rate limiting via NestJS `@Throttle` guard:

```typescript
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per 60 seconds
```

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `POST /next-question` | 10/min | Prevent API abuse |
| `POST /submit-answer` | 10/min | Prevent spam submissions |
| `POST /tts` | 5/min | Respect OpenAI limits |
| `POST /transcribe-chunk` | 30/min | Support real-time usage |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1697712000
```

---

## Configuration Summary

### Temperature Settings

| Task | Temperature | Reason |
|------|-------------|--------|
| Question generation | 0.85 | High diversity, prevents repetition |
| Difficulty verification | 0.2 | Deterministic, consistent judgment |
| Technical evaluation | 0.2 | Consistent scoring across candidates |
| Communication evaluation | 0.2 | Consistent scoring standards |
| Role evaluation | 0.3 | Slight variation for insights |
| Hint generation | 0.3 | Balanced clarity without giving answers |

### Response Format

All evaluation and hint endpoints enforce JSON:
```typescript
response_format: { type: 'json_object' }
```

**Benefits:**
- Forces valid JSON output
- Reduces parsing errors
- Eliminates markdown/explanation text

### Token Limits

| Task | Max Tokens | Reason |
|------|-----------|--------|
| Question generation | 180 | Concise questions (40-60 words) |
| Difficulty verification | 200 | Brief analysis only |
| Hint generation | 400 | Short guidance without answers |
| Communication eval | 400 | Focused feedback |
| Technical eval | 600 | Detailed analysis with examples |
| Role eval | 600 | Insights + follow-up questions |

### Model Selection

| Use Case | Model | Reason |
|----------|-------|--------|
| Text generation | llama-3.3-70b-versatile | Strong reasoning, diverse outputs |
| Speech-to-text | whisper-large-v3-turbo | Fast, accurate, 99 languages |
| Text-to-speech | tts-1 | Natural voice, cost-effective |

---
