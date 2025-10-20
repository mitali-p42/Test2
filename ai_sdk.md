# AI SDK Configuration Guide

This document provides detailed configuration and usage information for the AI services integrated into the interview platform.

## Overview

The platform uses two primary AI services:

1. **Groq SDK** - Speech-to-Text (Whisper) and LLM inference (Llama 3.3 70B)
2. **OpenAI SDK** - Text-to-Speech (TTS)

## Table of Contents

- [Groq SDK Setup](#groq-sdk-setup)
- [OpenAI SDK Setup](#openai-sdk-setup)
- [Configuration Details](#configuration-details)
- [API Rate Limits](#api-rate-limits)
- [Model Selection](#model-selection)
- [Error Handling](#error-handling)
- [Cost Optimization](#cost-optimization)

---

## Groq SDK Setup

### Installation

```bash
npm install groq-sdk
```

### API Key Configuration

1. Sign up at [console.groq.com](https://console.groq.com)
2. Generate an API key from the dashboard
3. Add to `.env`:

```env
GROQ_API_KEY=gsk_your_api_key_here
```

### Initialization

```typescript
import Groq from 'groq-sdk';

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY 
});
```

### Models Used

#### Speech-to-Text: Whisper Large V3 Turbo

**Model ID:** `whisper-large-v3-turbo`

**Features:**
- Ultra-fast transcription (8x faster than real-time)
- High accuracy for technical terminology
- Support for 99 languages
- Automatic language detection

**Configuration:**

```typescript
const transcription = await groq.audio.transcriptions.create({
  file: fs.createReadStream(audioPath),
  model: 'whisper-large-v3-turbo',
  language: 'en',              // Optional: auto-detect if omitted
  response_format: 'text',      // 'text' | 'json' | 'verbose_json'
  temperature: 0.0,             // 0.0 for deterministic output
});
```

**Response Formats:**
- `text` - Plain string (fastest)
- `json` - Text with metadata
- `verbose_json` - Includes timestamps and word-level confidence

#### LLM: Llama 3.3 70B Versatile

**Model ID:** `llama-3.3-70b-versatile`

**Features:**
- 128K context window
- Strong reasoning capabilities
- JSON mode for structured outputs
- Fast inference (60+ tokens/second)

**Configuration:**

```typescript
const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: 'You are an expert interviewer.' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.7,              // 0.0-2.0 (higher = more creative)
  max_tokens: 500,               // Max response length
  top_p: 0.9,                    // Nucleus sampling
  response_format: { type: 'json_object' }, // Force JSON output
});
```

**Temperature Guidelines:**
- `0.0-0.3` - Deterministic, factual (evaluations)
- `0.5-0.7` - Balanced (question generation)
- `0.8-1.2` - Creative (hints, explanations)

---

## OpenAI SDK Setup

### Installation

```bash
npm install openai
```

### API Key Configuration

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add to `.env`:

```env
OPENAI_API_KEY=sk-your_api_key_here
```

### Initialization

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});
```

### Text-to-Speech (TTS)

**Model:** `tts-1` (standard quality, fastest)

**Configuration:**

```typescript
const mp3 = await openai.audio.speech.create({
  model: 'tts-1',           // 'tts-1' or 'tts-1-hd'
  voice: 'alloy',           // See voice options below
  input: text,              // Text to convert (max 4096 chars)
  speed: 1.0,               // 0.25-4.0 (1.0 = normal)
});

const buffer = Buffer.from(await mp3.arrayBuffer());
```

**Voice Options:**
- `alloy` - Neutral, professional (default)
- `echo` - Warm, friendly
- `fable` - Expressive, storytelling
- `onyx` - Deep, authoritative
- `nova` - Energetic, young
- `shimmer` - Clear, bright

**Model Comparison:**
- `tts-1` - Fast, good quality ($15/1M chars)
- `tts-1-hd` - Higher fidelity, slower ($30/1M chars)

---

## Configuration Details

### AIService Class Structure

```typescript
@Injectable()
export class AIService {
  private groq: Groq;
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');

    // Warn but don't fail in development
    if (!groqKey) console.warn('⚠️  GROQ_API_KEY not set');
    if (!openaiKey) console.warn('⚠️  OPENAI_API_KEY not set');

    this.groq = new Groq({ apiKey: groqKey || 'dummy' });
    this.openai = new OpenAI({ apiKey: openaiKey || 'dummy' });
  }
}
```

### Key Methods

#### 1. Question Generation

```typescript
async generateQuestion(
  role: string,
  interviewType: string,
  yearsOfExperience: number,
  questionNumber: number,
  skills: string[] = []
)
```

**Prompt Engineering:**
- Includes candidate profile context
- Category-specific guidance
- Difficulty scaling rules
- Skill-targeted questioning

**Temperature:** 0.85 for diversity across questions

#### 2. Answer Evaluation (Multi-Agent)

Three specialized agents:

**Technical Agent:**
```typescript
async technicalAgentEvaluation(question, answer, role, experience)
```
- Technical accuracy assessment
- Problem-solving approach
- Red flag detection
- Scores: technicalAccuracy, depthOfKnowledge, problemSolvingApproach

**Communication Agent:**
```typescript
async communicationAgentEvaluation(answer)
```
- Clarity and structure
- Conciseness evaluation
- Communication strengths/improvements
- Score: communicationClarity

**Role-Specific Agent:**
```typescript
async roleSpecificAgentEvaluation(question, answer, role, experience)
```
- Relevance to role
- Experience level alignment
- Follow-up question generation
- Score: relevanceToRole

**Synthesis:**
```typescript
synthesizeEvaluations(technical, communication, roleSpecific, answer)
```
- Weighted scoring (Tech: 65%, Comm: 15%, Role: 20%)
- Penalty application for brief/generic answers
- Confidence calculation
- Comprehensive feedback generation

#### 3. Question Hints

```typescript
async generateQuestionHint(question, role, interviewType)
```

**Only available for hard difficulty questions**

Returns:
- `hint` - Clarification without giving answers
- `examples` - Types of considerations

**Temperature:** 0.3 for focused, helpful guidance

#### 4. Audio Transcription

**Standard Transcription:**
```typescript
async transcribeAudio(audioBuffer, filename)
```
- Returns plain text
- Cleans up temp files automatically

**Streaming Transcription:**
```typescript
async transcribeAudioStreaming(audioBuffer, filename)
```
- Returns verbose JSON with timestamps
- For real-time scenarios

**Chunk Transcription:**
```typescript
async transcribeAudioChunk(audioChunk, filename, previousContext)
```
- Processes audio segments
- Optional context for continuity

---

## API Rate Limits

### Groq API Limits

**Free Tier:**
- 30 requests per minute
- 14,400 requests per day
- No token limits

**Paid Tiers:**
- Higher RPM limits available
- Enterprise options for unlimited

**Best Practices:**
- Implement exponential backoff
- Cache question generations
- Batch evaluations when possible

### OpenAI API Limits

**TTS Rate Limits:**
- Tier 1: 3 RPM, 200,000 chars/day
- Tier 2: 50 RPM, 2M chars/day
- Tier 3+: Higher limits

**Cost Estimates:**
- Average question: ~60 chars = $0.001
- 1000 interviews (5 questions): ~$5

---

## Model Selection

### When to Use Different Models

#### Groq Models

**Llama 3.3 70B Versatile** (Current)
- Best for: Complex reasoning, evaluations
- Context: 128K tokens
- Speed: 60+ tokens/sec

**Alternatives:**
- `llama-3.1-8b-instant` - Faster, less accurate
- `mixtral-8x7b-32768` - Good balance

#### OpenAI TTS Models

**tts-1** (Current)
- Best for: Real-time question delivery
- Latency: ~500ms for 100 words
- Quality: Good for speech

**tts-1-hd**
- Best for: Pre-recorded content
- Latency: ~1-2s for 100 words
- Quality: Excellent clarity

---

## Error Handling

### Groq Error Patterns

```typescript
try {
  const completion = await groq.chat.completions.create({...});
} catch (error: any) {
  if (error.status === 429) {
    // Rate limit - implement retry
  } else if (error.status === 401) {
    // Invalid API key
  } else if (error.status === 500) {
    // Groq service error - use fallback
  }
}
```

### JSON Parsing Safety

```typescript
private safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // Try extracting from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    
    // Try finding JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    
    // Direct parse
    return JSON.parse(text);
  } catch (error) {
    console.error('JSON parse failed, using fallback');
    return fallback;
  }
}
```

### Fallback Strategies

**Question Generation:**
```typescript
private getFallbackQuestion(category, role, questionNumber): string {
  // Pre-defined questions by category
}
```

**Evaluation:**
```typescript
private getFallbackEvaluation(answer): DetailedEvaluation {
  // Conservative neutral scores (70/100)
  // Allows interview to continue
}
```

---

## Cost Optimization

### Groq Cost Optimization

**Free Tier Usage:**
- Current implementation stays within free tier limits
- Question generation: ~500 tokens per question
- Evaluation: ~1000 tokens per answer
- 5-question interview: ~7,500 tokens total

**Optimization Strategies:**
1. **Prompt Compression**: Remove verbose instructions
2. **Caching**: Store generated questions for common roles
3. **Batch Processing**: Evaluate multiple answers together
4. **Token Limits**: Set max_tokens appropriately

### OpenAI Cost Optimization

**Current Costs (per interview):**
- 5 questions × 60 chars = 300 chars
- 300 chars × $0.000015 = $0.0045

**Optimization Strategies:**
1. **Pre-generate Audio**: Cache common questions
2. **Model Selection**: Use `tts-1` instead of `tts-1-hd`
3. **Batch Requests**: Generate multiple at once
4. **Client-side TTS**: Consider browser APIs for simple cases

### Monitoring Usage

```typescript
// Add usage tracking
const startTime = Date.now();
const result = await groq.chat.completions.create({...});
const latency = Date.now() - startTime;

console.log({
  model: 'llama-3.3-70b',
  tokens: result.usage.total_tokens,
  latency,
  cost: calculateCost(result.usage)
});
```

---

## Advanced Configuration

### Custom System Prompts

```typescript
const EVALUATION_SYSTEM_PROMPT = `You are a technical assessment specialist.
- Provide scores from 0-100
- Be objective and data-driven
- Focus on specific examples
- Respond with valid JSON only`;
```

### Response Format Enforcement

```typescript
// Force structured output
response_format: { type: 'json_object' }

// Verify in prompt
"CRITICAL: You MUST return ONLY valid JSON..."
```

### Temperature Tuning

```typescript
const TEMPERATURE_CONFIG = {
  evaluation: 0.2,      // Deterministic scoring
  questionGen: 0.85,    // Creative variety
  hints: 0.3,           // Focused guidance
  transcription: 0.0,   // Accurate STT
};
```

### Context Window Management

```typescript
// Llama 3.3 70B: 128K tokens
const MAX_CONTEXT = 100000; // Leave buffer

function truncateContext(text: string): string {
  const tokens = estimateTokens(text);
  if (tokens > MAX_CONTEXT) {
    return text.substring(0, MAX_CONTEXT * 4); // ~4 chars per token
  }
  return text;
}
```

---

## Troubleshooting

### Common Issues

**1. "Groq API Key Invalid"**
- Verify key starts with `gsk_`
- Check key hasn't expired
- Ensure no whitespace in `.env`

**2. "Rate Limit Exceeded"**
- Implement retry with exponential backoff
- Reduce concurrent requests
- Consider paid tier

**3. "JSON Parsing Failed"**
- Check `safeJsonParse` implementation
- Verify `response_format: { type: 'json_object' }`
- Review LLM system prompts

**4. "Audio Transcription Timeout"**
- File too large (max 25MB)
- Check `/tmp` directory permissions
- Verify audio format (WebM/MP3/WAV)

**5. "TTS Generation Failed"**
- Text exceeds 4096 character limit
- Invalid OpenAI API key
- Check account balance

### Debug Mode

```typescript
// Enable verbose logging
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('🔍 Groq Request:', {
    model,
    temperature,
    maxTokens,
    promptLength: prompt.length
  });
}
```

---

## Best Practices

1. **Always use fallbacks** for LLM failures
2. **Validate JSON** before parsing (use `response_format`)
3. **Log usage metrics** for cost tracking
4. **Implement retries** with exponential backoff
5. **Cache results** when possible
6. **Monitor latency** and set timeouts
7. **Handle errors gracefully** to not break user flow
8. **Test with various inputs** including edge cases

## References

- [Groq Documentation](https://console.groq.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Whisper Model Card](https://github.com/openai/whisper)
- [Llama 3.3 Release Notes](https://ai.meta.com/llama/)