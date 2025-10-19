// backend/src/interview/ai.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Enhanced Evaluation Result Type
export interface DetailedEvaluation {
  overallScore: number;
  technicalAccuracy: number;
  communicationClarity: number;
  depthOfKnowledge: number;
  problemSolvingApproach: number;
  relevanceToRole: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  keyInsights: string[];
  wordCount: number;
  answerDuration?: number;
  confidence: 'low' | 'medium' | 'high';
  redFlags: string[];
  followUpQuestions: string[];
}
export interface QuestionHint {
  hint: string;
  examples?: string[];
}

const QUESTION_CATEGORIES = {
  behavioral: [
    'Tell me about a time when',
    'Describe a situation where',
    'Give me an example of',
    'Walk me through a challenging',
  ],
  technical: [
    'Explain how you would',
    'What are the trade-offs between',
    'Design a system that',
    'How would you optimize',
  ],
  situational: [
    'If you were faced with',
    'How would you handle',
    'What would be your approach to',
    'Imagine a scenario where',
  ],
  competency: [
    'How do you measure success in',
    'What frameworks do you use for',
    'Describe your process for',
    'How do you ensure quality in',
  ],
  problemSolving: [
    'Analyze this problem:',
    'How would you debug',
    'Optimize this scenario:',
    'Break down the following challenge:',
  ],
};

@Injectable()
export class AIService {
  private groq: Groq;
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!groqKey) console.warn('⚠️  GROQ_API_KEY not set');
    if (!openaiKey) console.warn('⚠️  OPENAI_API_KEY not set');

    this.groq = new Groq({ apiKey: groqKey || 'dummy' });
    this.openai = new OpenAI({ apiKey: openaiKey || 'dummy' });
  }

  // 🆕 Helper: Safe JSON parsing with fallback
  private safeJsonParse<T>(text: string, fallback: T): T {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try to extract JSON from curly braces
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }

      // Try direct parse
      return JSON.parse(text);
    } catch (error) {
      console.error('❌ JSON parse failed, using fallback:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textPreview: text.substring(0, 200),
      });
      return fallback;
    }
  }
  

  private getQuestionCategory(questionNumber: number): string {
    const categories = Object.keys(QUESTION_CATEGORIES);
    const categoryIndex = (questionNumber - 1) % categories.length;
    return categories[categoryIndex];
  }

  private getRandomStarter(category: string): string {
    const starters = QUESTION_CATEGORIES[category as keyof typeof QUESTION_CATEGORIES] || [];
    return starters[Math.floor(Math.random() * starters.length)] || '';
  }

  async generateQuestionHint(
  question: string,
  role: string,
  interviewType: string,
): Promise<QuestionHint> {
  try {
    const prompt = `You are helping an interview candidate understand a question better WITHOUT giving away the answer.

QUESTION: ${question}
ROLE: ${role}
INTERVIEW TYPE: ${interviewType}

Your task: Provide a helpful CONCISE that:
1. Clarifies what the question is really asking in 1 or 2 sentences
2. Explains key concepts or terminology
3. Suggests what aspects to consider in the answer 
4. Does NOT provide the actual answer or specific examples to use

CRITICAL: Return ONLY valid JSON with this structure:
{
  "hint": "A clear, concise explanation of what the question is asking (2-3 sentences)",
  "examples": ["Example type 1 to consider", "Example type 2 to consider"]
}`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful interview coach who clarifies questions without giving away answers. Respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const result = this.safeJsonParse<QuestionHint>(responseText, {
      hint: 'Consider breaking down the question into parts: What is being asked? What experience or knowledge would be relevant? What would a strong answer demonstrate?',
      examples: ['Past projects', 'Problem-solving approach', 'Team collaboration'],
    });

    console.log('💡 Generated hint:', result.hint);
    return result;
  } catch (error: any) {
    console.error('❌ Hint generation failed:', error);
    return {
      hint: 'Think about: What is this question trying to evaluate? What specific experiences or knowledge would demonstrate your capability in this area?',
      examples: ['Relevant past work', 'Problem-solving methods', 'Results achieved'],
    };
  }
}

//   async generateQuestionHint(
//     question: string,
//     role: string,
//     interviewType: string,
//   ): Promise<QuestionHint> {
//     try {
//       const prompt = `You are helping an interview candidate understand a question better WITHOUT giving away the answer.

// QUESTION: ${question}
// ROLE: ${role}
// INTERVIEW TYPE: ${interviewType}

// Your task: Provide a helpful hint that:
// 1. Clarifies what the question is really asking
// 2. Explains key concepts or terminology
// 3. Suggests what aspects to consider in the answer
// 4. Does NOT provide the actual answer or specific examples to use

// CRITICAL: Return ONLY valid JSON with this structure:
// {
//   "hint": "A clear, concise explanation of what the question is asking (2-3 sentences)",
//   "keyTerms": ["term1", "term2", "term3"],
//   "examples": ["Example type 1 to consider", "Example type 2 to consider"]
// }`;

//       const completion = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: [
//           {
//             role: 'system',
//             content: 'You are a helpful interview coach who clarifies questions without giving away answers. Respond with valid JSON only.',
//           },
//           { role: 'user', content: prompt },
//         ],
//         temperature: 0.3,
//         max_tokens: 400,
//         response_format: { type: 'json_object' },
//       });

//       const responseText = completion.choices[0]?.message?.content || '{}';
//       const result = this.safeJsonParse<QuestionHint>(responseText, {
//         hint: 'Consider breaking down the question into parts: What is being asked? What experience or knowledge would be relevant? What would a strong answer demonstrate?',
//         keyTerms: ['experience', 'approach', 'methodology'],
//         examples: ['Past projects', 'Problem-solving approach', 'Team collaboration'],
//       });

//       console.log('💡 Generated hint:', result.hint);
//       return result;
//     } catch (error: any) {
//       console.error('❌ Hint generation failed:', error);
//       return {
//         hint: 'Think about: What is this question trying to evaluate? What specific experiences or knowledge would demonstrate your capability in this area?',
//         keyTerms: ['experience', 'skills', 'approach'],
//         examples: ['Relevant past work', 'Problem-solving methods', 'Results achieved'],
//       };
//     }
//   }

//   async generateQuestionHint(
//     question: string,
//     role: string,
//     interviewType: string,
//     difficulty?: 'easy' | 'medium' | 'hard', // 🆕 Add optional difficulty parameter
//   ): Promise<QuestionHint> {
//     try {
//       const difficultyContext = difficulty 
//         ? `\nQUESTION DIFFICULTY: ${difficulty.toUpperCase()}\n(Consider this when providing guidance - don't make hints too revealing for easier questions)`
//         : '';

//       const prompt = `You are helping an interview candidate understand a question better WITHOUT giving away the answer.

// QUESTION: ${question}
// ROLE: ${role}
// INTERVIEW TYPE: ${interviewType}${difficultyContext}

// Your task: Provide a helpful hint that:
// 1. Clarifies what the question is really asking
// 2. Explains key concepts or terminology
// 3. Suggests what aspects to consider in the answer
// 4. Does NOT provide the actual answer or specific examples to use

// CRITICAL: Return ONLY valid JSON with this structure:
// {
//   "hint": "A clear, concise explanation of what the question is asking (2-3 sentences)",
//   "keyTerms": ["term1", "term2", "term3"],
//   "examples": ["Example type 1 to consider", "Example type 2 to consider"]
// }`;

//       const completion = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: [
//           {
//             role: 'system',
//             content: 'You are a helpful interview coach who clarifies questions without giving away answers. Respond with valid JSON only.',
//           },
//           { role: 'user', content: prompt },
//         ],
//         temperature: 0.3,
//         max_tokens: 400,
//         response_format: { type: 'json_object' },
//       });

//       const responseText = completion.choices[0]?.message?.content || '{}';
//       const result = this.safeJsonParse<QuestionHint>(responseText, {
//         hint: 'Consider breaking down the question into parts: What is being asked? What experience or knowledge would be relevant? What would a strong answer demonstrate?',
//         keyTerms: ['experience', 'approach', 'methodology'],
//         examples: ['Past projects', 'Problem-solving approach', 'Team collaboration'],
//       });

//       console.log('💡 Generated hint:', result.hint);
//       return result;
//     } catch (error: any) {
//       console.error('❌ Hint generation failed:', error);
//       return {
//         hint: 'Think about: What is this question trying to evaluate? What specific experiences or knowledge would demonstrate your capability in this area?',
//         keyTerms: ['experience', 'skills', 'approach'],
//         examples: ['Relevant past work', 'Problem-solving methods', 'Results achieved'],
//       };
//     }
//   }
  async transcribeAudio(audioBuffer: Buffer, filename: string = 'audio.webm'): Promise<string> {
    try {
      const tempPath = path.join('/tmp', filename);
      fs.writeFileSync(tempPath, audioBuffer);

      const transcription = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-large-v3-turbo',
        language: 'en',
        response_format: 'text',
      });

      fs.unlinkSync(tempPath);
      return typeof transcription === 'string' ? transcription : transcription.text || '';
    } catch (error: any) {
      console.error('Groq STT error:', error.message);
      throw new Error('Transcription failed');
    }
  }
  async transcribeAudioStreaming(audioBuffer: Buffer, filename: string = 'audio.webm'): Promise<string> {
  try {
    const tempPath = path.join('/tmp', filename);
    fs.writeFileSync(tempPath, audioBuffer);

    console.log('🎙️ Starting streaming transcription:', { size: audioBuffer.length });

    const transcription = await this.groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'verbose_json', // Get detailed timestamps
      temperature: 0.0, // More deterministic for live transcription
    });

    fs.unlinkSync(tempPath);
    
    const text = typeof transcription === 'string' ? transcription : transcription.text || '';
    console.log('✅ Streaming transcription complete:', { length: text.length });
    
    return text;
  } catch (error: any) {
    console.error('❌ Groq streaming STT error:', error.message);
    throw new Error('Streaming transcription failed');
  }
}
async transcribeAudioChunk(
  audioChunk: Buffer, 
  filename: string = 'chunk.webm',
  previousContext: string = ''
): Promise<{ text: string; confidence?: number }> {
  try {
    const tempPath = path.join('/tmp', filename);
    fs.writeFileSync(tempPath, audioChunk);

    const transcription = await this.groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'verbose_json',
      temperature: 0.0,
      prompt: previousContext, // Use previous context for better continuity
    });

    fs.unlinkSync(tempPath);

    const result = typeof transcription === 'string' 
      ? { text: transcription, confidence: undefined }
      : { 
          text: transcription.text || '', 
          confidence: transcription.segments?.[0]?.avg_logprob 
        };

    return result;
  } catch (error: any) {
    console.error('❌ Chunk transcription error:', error.message);
    return { text: '', confidence: 0 };
  }
}
//   async generateQuestion(
//     role: string,
//     interviewType: string,
//     yearsOfExperience: number | string,
//     questionNumber: number,
//   ): Promise<{ question: string; difficulty: 'easy' | 'medium' | 'hard' }> {
//     try {
//       const category = this.getQuestionCategory(questionNumber);
//       const starter = this.getRandomStarter(category);
      
//       // 🆕 Determine difficulty based on experience level
//       const experience = Number(yearsOfExperience) || 0;
//       let targetDifficulty: 'easy' | 'medium' | 'hard';
      
//       if (experience < 2) {
//         targetDifficulty = questionNumber <= 2 ? 'easy' : 'medium';
//       } else if (experience < 5) {
//         targetDifficulty = questionNumber <= 1 ? 'easy' : questionNumber <= 3 ? 'medium' : 'hard';
//       } else {
//         targetDifficulty = questionNumber <= 1 ? 'medium' : 'hard';
//       }

//       const prompt = `You are conducting a professional ${interviewType} interview for a ${role} position.

// CANDIDATE PROFILE:
// - Experience Level: ${yearsOfExperience} years
// - Target Role: ${role}
// - Interview Type: ${interviewType}

// QUESTION ${questionNumber}/5 REQUIREMENTS:
// 📋 Category: ${category.toUpperCase()}
// 🎯 Focus Area: ${this.getCategoryGuidance(category, role, interviewType)}
// 💡 Starter Template: "${starter}"
// 🎚️ Difficulty: ${targetDifficulty.toUpperCase()} (for ${yearsOfExperience} years experience)

// DIFFICULTY GUIDELINES:
// - EASY: Basic concepts, straightforward scenarios, common situations
// - MEDIUM: Moderate complexity, requires some critical thinking, real-world application
// - HARD: Complex scenarios, requires deep expertise, strategic thinking, trade-off analysis

// INSTRUCTIONS:
// 1. Create a unique, thought-provoking question at ${targetDifficulty} difficulty level
// 2. Tailor complexity to ${yearsOfExperience} years of experience
// 3. Make it ${category}-focused and role-specific
// 4. Keep it conversational (40-60 words)
// 5. Avoid generic questions - be specific to ${role}
// 6. Ensure the question tests real competency at the ${targetDifficulty} level

// Generate ONE clear, focused question (no numbering or preamble):`;

//       const completion = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: [
//           { 
//             role: 'system', 
//             content: `You are an expert interviewer specializing in ${category} assessment. Generate diverse, insightful questions at appropriate difficulty levels that reveal true candidate capabilities.` 
//           },
//           { role: 'user', content: prompt },
//         ],
//         temperature: 0.85,
//         top_p: 0.9,
//         max_tokens: 180,
//       });

//       const question = completion.choices[0]?.message?.content?.trim();
      
//       if (!question) {
//         return {
//           question: this.getFallbackQuestion(category, role, questionNumber),
//           difficulty: targetDifficulty,
//         };
//       }
      
//       // 🆕 Verify difficulty of generated question
//       const verifiedDifficulty = await this.verifyQuestionDifficulty(
//         question,
//         role,
//         yearsOfExperience,
//         targetDifficulty,
//       );
      
//       return {
//         question,
//         difficulty: verifiedDifficulty,
//       };
//     } catch (error: any) {
//       console.error('Groq LLM error:', error.message);
//       const fallbackDifficulty = Number(yearsOfExperience) < 2 ? 'easy' : 'medium';
//       return {
//         question: this.getFallbackQuestion('technical', role, questionNumber),
//         difficulty: fallbackDifficulty,
//       };
//     }
//   }
  // This goes right after the generateQuestion method and BEFORE getCategoryGuidance
  async generateQuestion(
    role: string,
    interviewType: string,
    yearsOfExperience: number | string,
    questionNumber: number,
  ): Promise<{ question: string; difficulty: 'easy' | 'medium' | 'hard' }> {
    try {
      const category = this.getQuestionCategory(questionNumber);
      const starter = this.getRandomStarter(category);
      
      // 🆕 Determine difficulty based on experience level
      const experience = Number(yearsOfExperience) || 0;
      let targetDifficulty: 'easy' | 'medium' | 'hard';
      
      if (experience < 2) {
        targetDifficulty = questionNumber <= 2 ? 'easy' : 'medium';
      } else if (experience < 5) {
        targetDifficulty = questionNumber <= 1 ? 'easy' : questionNumber <= 3 ? 'medium' : 'hard';
      } else {
        targetDifficulty = questionNumber <= 1 ? 'medium' : 'hard';
      }

      const prompt = `You are conducting a professional ${interviewType} interview for a ${role} position.

CANDIDATE PROFILE:
- Experience Level: ${yearsOfExperience} years
- Target Role: ${role}
- Interview Type: ${interviewType}

QUESTION ${questionNumber}/5 REQUIREMENTS:
📋 Category: ${category.toUpperCase()}
🎯 Focus Area: ${this.getCategoryGuidance(category, role, interviewType)}
💡 Starter Template: "${starter}"
🎚️ Difficulty: ${targetDifficulty.toUpperCase()} (for ${yearsOfExperience} years experience)

DIFFICULTY GUIDELINES:
- EASY: Basic concepts, straightforward scenarios, common situations
- MEDIUM: Moderate complexity, requires some critical thinking, real-world application
- HARD: Complex scenarios, requires deep expertise, strategic thinking, trade-off analysis

INSTRUCTIONS:
1. Create a unique, thought-provoking question at ${targetDifficulty} difficulty level
2. Tailor complexity to ${yearsOfExperience} years of experience
3. Make it ${category}-focused and role-specific
4. Keep it conversational (40-60 words)
5. Avoid generic questions - be specific to ${role}
6. Ensure the question tests real competency at the ${targetDifficulty} level

Generate ONE clear, focused question (no numbering or preamble):`;

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert interviewer specializing in ${category} assessment. Generate diverse, insightful questions at appropriate difficulty levels that reveal true candidate capabilities.` 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.85,
        top_p: 0.9,
        max_tokens: 180,
      });

      const question = completion.choices[0]?.message?.content?.trim();
      
      if (!question) {
        return {
          question: this.getFallbackQuestion(category, role, questionNumber),
          difficulty: targetDifficulty,
        };
      }
      
      // 🆕 Verify difficulty of generated question
      const verifiedDifficulty = await this.verifyQuestionDifficulty(
        question,
        role,
        yearsOfExperience,
        targetDifficulty,
      );
      
      return {
        question,
        difficulty: verifiedDifficulty,
      };
    } catch (error: any) {
      console.error('Groq LLM error:', error.message);
      const fallbackDifficulty = Number(yearsOfExperience) < 2 ? 'easy' : 'medium';
      return {
        question: this.getFallbackQuestion('technical', role, questionNumber),
        difficulty: fallbackDifficulty,
      };
    }
  }

  // 🆕 Add this new method right after generateQuestion
  private async verifyQuestionDifficulty(
    question: string,
    role: string,
    yearsOfExperience: number | string,
    targetDifficulty: 'easy' | 'medium' | 'hard',
  ): Promise<'easy' | 'medium' | 'hard'> {
    try {
      const prompt = `Analyze this interview question and determine its difficulty level.

QUESTION: ${question}
ROLE: ${role}
CANDIDATE EXPERIENCE: ${yearsOfExperience} years
TARGET DIFFICULTY: ${targetDifficulty}

Difficulty Criteria:
- EASY: Basic concepts, straightforward recall, common scenarios. Suitable for 0-2 years experience.
- MEDIUM: Moderate complexity, requires analytical thinking, real-world application. Suitable for 2-5 years.
- HARD: Complex scenarios, requires deep expertise, strategic trade-offs, advanced problem-solving. Suitable for 5+ years.

CRITICAL: Return ONLY valid JSON with this structure:
{
  "difficulty": "easy" | "medium" | "hard",
  "reasoning": "Brief explanation"
}`;

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at assessing interview question difficulty. Respond with valid JSON only.' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const result = this.safeJsonParse<{ difficulty: 'easy' | 'medium' | 'hard'; reasoning: string }>(
        responseText,
        { difficulty: targetDifficulty, reasoning: 'Fallback to target difficulty' },
      );

      console.log(`📊 Difficulty analysis: ${result.difficulty} (target: ${targetDifficulty}) - ${result.reasoning}`);
      
      return result.difficulty;
    } catch (error: any) {
      console.error('❌ Difficulty verification failed:', error);
      return targetDifficulty;
    }
  }
//   private async verifyQuestionDifficulty(
//     question: string,
//     role: string,
//     yearsOfExperience: number | string,
//     targetDifficulty: 'easy' | 'medium' | 'hard',
//   ): Promise<'easy' | 'medium' | 'hard'> {
//     try {
//       const prompt = `Analyze this interview question and determine its difficulty level.

// QUESTION: ${question}
// ROLE: ${role}
// CANDIDATE EXPERIENCE: ${yearsOfExperience} years
// TARGET DIFFICULTY: ${targetDifficulty}

// Difficulty Criteria:
// - EASY: Basic concepts, straightforward recall, common scenarios. Suitable for 0-2 years experience.
// - MEDIUM: Moderate complexity, requires analytical thinking, real-world application. Suitable for 2-5 years.
// - HARD: Complex scenarios, requires deep expertise, strategic trade-offs, advanced problem-solving. Suitable for 5+ years.

// CRITICAL: Return ONLY valid JSON with this structure:
// {
//   "difficulty": "easy" | "medium" | "hard",
//   "reasoning": "Brief explanation"
// }`;

//       const completion = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: [
//           { 
//             role: 'system', 
//             content: 'You are an expert at assessing interview question difficulty. Respond with valid JSON only.' 
//           },
//           { role: 'user', content: prompt },
//         ],
//         temperature: 0.2,
//         max_tokens: 200,
//         response_format: { type: 'json_object' },
//       });

//       const responseText = completion.choices[0]?.message?.content || '{}';
//       const result = this.safeJsonParse<{ difficulty: 'easy' | 'medium' | 'hard'; reasoning: string }>(
//         responseText,
//         { difficulty: targetDifficulty, reasoning: 'Fallback to target difficulty' },
//       );

//       console.log(`📊 Difficulty analysis: ${result.difficulty} (target: ${targetDifficulty}) - ${result.reasoning}`);
      
//       return result.difficulty;
//     } catch (error: any) {
//       console.error('❌ Difficulty verification failed:', error);
//       return targetDifficulty;
//     }
//   }

//   async generateQuestion(
//     role: string,
//     interviewType: string,
//     yearsOfExperience: number | string,
//     questionNumber: number,
//   ): Promise<string> {
//     try {
//       const category = this.getQuestionCategory(questionNumber);
//       const starter = this.getRandomStarter(category);

//       const prompt = `You are conducting a professional ${interviewType} interview for a ${role} position.

// CANDIDATE PROFILE:
// - Experience Level: ${yearsOfExperience} years
// - Target Role: ${role}
// - Interview Type: ${interviewType}

// QUESTION ${questionNumber}/5 REQUIREMENTS:
// 📋 Category: ${category.toUpperCase()}
// 🎯 Focus Area: ${this.getCategoryGuidance(category, role, interviewType)}
// 💡 Starter Template: "${starter}"

// INSTRUCTIONS:
// 1. Create a unique, thought-provoking question
// 2. Tailor complexity to ${yearsOfExperience} years of experience
// 3. Make it ${category}-focused and role-specific
// 4. Keep it conversational (40-60 words)
// 5. Avoid generic questions - be specific to ${role}
// 6. Ensure the question tests real competency

// Generate ONE clear, focused question (no numbering or preamble):`;

//       const completion = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: [
//           { 
//             role: 'system', 
//             content: `You are an expert interviewer specializing in ${category} assessment. Generate diverse, insightful questions that reveal true candidate capabilities.` 
//           },
//           { role: 'user', content: prompt },
//         ],
//         temperature: 0.85,
//         top_p: 0.9,
//         max_tokens: 180,
//       });

//       const question = completion.choices[0]?.message?.content?.trim();
//       return question || this.getFallbackQuestion(category, role, questionNumber);
//     } catch (error: any) {
//       console.error('Groq LLM error:', error.message);
//       return this.getFallbackQuestion('technical', role, questionNumber);
//     }
//   }
//   async generateQuestion(
//     role: string,
//     interviewType: string,
//     yearsOfExperience: number | string,
//     questionNumber: number,
//   ): Promise<{ question: string; difficulty: 'easy' | 'medium' | 'hard' }> {
//     try {
//       const category = this.getQuestionCategory(questionNumber);
//       const starter = this.getRandomStarter(category);
      
//       // 🆕 Determine difficulty based on experience level
//       const experience = Number(yearsOfExperience) || 0;
//       let targetDifficulty: 'easy' | 'medium' | 'hard';
      
//       if (experience < 2) {
//         targetDifficulty = questionNumber <= 2 ? 'easy' : 'medium';
//       } else if (experience < 5) {
//         targetDifficulty = questionNumber <= 1 ? 'easy' : questionNumber <= 3 ? 'medium' : 'hard';
//       } else {
//         targetDifficulty = questionNumber <= 1 ? 'medium' : 'hard';
//       }

//       const prompt = `You are conducting a professional ${interviewType} interview for a ${role} position.

// CANDIDATE PROFILE:
// - Experience Level: ${yearsOfExperience} years
// - Target Role: ${role}
// - Interview Type: ${interviewType}

// QUESTION ${questionNumber}/5 REQUIREMENTS:
// 📋 Category: ${category.toUpperCase()}
// 🎯 Focus Area: ${this.getCategoryGuidance(category, role, interviewType)}
// 💡 Starter Template: "${starter}"
// 🎚️ Difficulty: ${targetDifficulty.toUpperCase()} (for ${yearsOfExperience} years experience)

// DIFFICULTY GUIDELINES:
// - EASY: Basic concepts, straightforward scenarios, common situations
// - MEDIUM: Moderate complexity, requires some critical thinking, real-world application
// - HARD: Complex scenarios, requires deep expertise, strategic thinking, trade-off analysis

// INSTRUCTIONS:
// 1. Create a unique, thought-provoking question at ${targetDifficulty} difficulty level
// 2. Tailor complexity to ${yearsOfExperience} years of experience
// 3. Make it ${category}-focused and role-specific
// 4. Keep it conversational (40-60 words)
// 5. Avoid generic questions - be specific to ${role}
// 6. Ensure the question tests real competency at the ${targetDifficulty} level

// Generate ONE clear, focused question (no numbering or preamble):`;

//       const completion = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: [
//           { 
//             role: 'system', 
//             content: `You are an expert interviewer specializing in ${category} assessment. Generate diverse, insightful questions at appropriate difficulty levels that reveal true candidate capabilities.` 
//           },
//           { role: 'user', content: prompt },
//         ],
//         temperature: 0.85,
//         top_p: 0.9,
//         max_tokens: 180,
//       });

//       const question = completion.choices[0]?.message?.content?.trim();
      
//       if (!question) {
//         return {
//           question: this.getFallbackQuestion(category, role, questionNumber),
//           difficulty: targetDifficulty,
//         };
//       }
      
//       // 🆕 Verify difficulty of generated question
//       const verifiedDifficulty = await this.verifyQuestionDifficulty(
//         question,
//         role,
//         yearsOfExperience,
//         targetDifficulty,
//       );
      
//       return {
//         question,
//         difficulty: verifiedDifficulty,
//       };
//     } catch (error: any) {
//       console.error('Groq LLM error:', error.message);
//       const fallbackDifficulty = Number(yearsOfExperience) < 2 ? 'easy' : 'medium';
//       return {
//         question: this.getFallbackQuestion('technical', role, questionNumber),
//         difficulty: fallbackDifficulty,
//       };
//     }
//   }
  private getCategoryGuidance(category: string, role: string, interviewType: string): string {
    const guidance: Record<string, string> = {
      behavioral: `Past experiences demonstrating ${role} skills and decision-making`,
      technical: `Deep ${interviewType} expertise and problem-solving for ${role}`,
      situational: `Realistic scenarios testing ${role} judgment and adaptability`,
      competency: `Core ${role} competencies, methodologies, and best practices`,
      problemSolving: `Analytical thinking and systematic approach relevant to ${role}`,
    };
    return guidance[category] || 'Relevant interview question';
  }

  private getFallbackQuestion(category: string, role: string, questionNumber: number): string {
    const fallbacks: Record<string, string> = {
      behavioral: `Tell me about the most challenging ${role} project you've led. What obstacles did you face and how did you overcome them?`,
      technical: `Walk me through your approach to solving complex technical problems in your ${role} work. Give me a specific example.`,
      situational: `Imagine your team is behind schedule on a critical deliverable. As a ${role}, how would you handle this situation?`,
      competency: `Describe your methodology for ${role}-related decision making. How do you balance competing priorities?`,
      problemSolving: `You're given a system that's performing poorly. Walk me through your diagnostic and optimization process as a ${role}.`,
    };
    return fallbacks[category] || `Question ${questionNumber}: Describe your experience as a ${role}.`;
  }

  async evaluateAnswer(
    question: string,
    answer: string,
    role: string,
    yearsOfExperience: number | string,
    questionNumber: number,
  ): Promise<DetailedEvaluation> {
    try {
      console.log('🤖 Starting multi-agent evaluation...');

      const technicalAssessment = await this.technicalAgentEvaluation(
        question,
        answer,
        role,
        yearsOfExperience,
      );

      const communicationAssessment = await this.communicationAgentEvaluation(answer);

      const roleAssessment = await this.roleSpecificAgentEvaluation(
        question,
        answer,
        role,
        yearsOfExperience,
      );

      const finalEvaluation = this.synthesizeEvaluations(
        technicalAssessment,
        communicationAssessment,
        roleAssessment,
        answer,
      );

      console.log('✅ Multi-agent evaluation complete:', {
        overallScore: finalEvaluation.overallScore,
        confidence: finalEvaluation.confidence,
      });

      return finalEvaluation;
    } catch (error: any) {
      console.error('❌ Evaluation error:', error.message);
      return this.getFallbackEvaluation(answer);
    }
  }

  private async technicalAgentEvaluation(
    question: string,
    answer: string,
    role: string,
    yearsOfExperience: number | string,
  ): Promise<any> {
    const experience = Number(yearsOfExperience) || 0;
    const minExpectedWords = experience < 2 ? 30 : experience < 5 ? 50 : 80;
    const answerWordCount = answer.trim().split(/\s+/).length;

    const prompt = `You are a technical interviewer evaluating a ${role} candidate with ${yearsOfExperience} years of experience.

QUESTION ASKED:
${question}

CANDIDATE'S ANSWER:
${answer}

EVALUATION CONTEXT:
- Role: ${role}
- Experience Level: ${yearsOfExperience} years
- Answer Length: ${answerWordCount} words (Expected minimum: ${minExpectedWords} words)

CRITICAL: You MUST return ONLY valid JSON. No markdown, no explanations, ONLY the JSON object.

Return ONLY this JSON structure (no other text):
{
  "technicalAccuracy": <0-100>,
  "depthOfKnowledge": <0-100>,
  "problemSolvingApproach": <0-100>,
  "technicalStrengths": ["point1", "point2"],
  "technicalGaps": ["gap1", "gap2"],
  "redFlags": ["flag1"] or [],
  "reasoning": "Brief explanation"
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are a technical assessment specialist. You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' }, // Force JSON output
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const result = this.safeJsonParse(responseText, {
        technicalAccuracy: 35,
        depthOfKnowledge: 30,
        problemSolvingApproach: 30,
        technicalStrengths: [],
        technicalGaps: ['Unable to evaluate due to parsing error'],
        redFlags: ['Evaluation parsing failed'],
        reasoning: 'Fallback evaluation used',
      });

      // Additional validation
      if (answerWordCount < minExpectedWords) {
        result.technicalAccuracy = Math.min(result.technicalAccuracy || 0, 40);
        result.depthOfKnowledge = Math.min(result.depthOfKnowledge || 0, 35);
        result.problemSolvingApproach = Math.min(result.problemSolvingApproach || 0, 35);
        if (!result.redFlags) result.redFlags = [];
        result.redFlags.push(`Answer too brief (${answerWordCount} words, expected ${minExpectedWords}+)`);
      }

      const genericPatterns = /^(hello|hi|yes|no|okay|ok|sure|maybe|perhaps|i think|um|uh)[\s.,!?]*$/i;
      if (genericPatterns.test(answer.trim()) || answerWordCount < 5) {
        result.technicalAccuracy = Math.min(result.technicalAccuracy || 0, 15);
        result.depthOfKnowledge = Math.min(result.depthOfKnowledge || 0, 10);
        result.problemSolvingApproach = Math.min(result.problemSolvingApproach || 0, 10);
        if (!result.redFlags) result.redFlags = [];
        result.redFlags.push('Generic or trivial answer - no meaningful content');
      }

      console.log('📊 Technical Assessment:', {
        wordCount: answerWordCount,
        minExpected: minExpectedWords,
        scores: {
          technical: result.technicalAccuracy,
          depth: result.depthOfKnowledge,
          problemSolving: result.problemSolvingApproach,
        },
        redFlags: result.redFlags,
      });

      return result;
    } catch (error: any) {
      console.error('Technical evaluation error:', error);
      return {
        technicalAccuracy: 35,
        depthOfKnowledge: 30,
        problemSolvingApproach: 30,
        technicalStrengths: [],
        technicalGaps: ['Evaluation failed'],
        redFlags: ['Technical assessment error'],
        reasoning: 'Error fallback',
      };
    }
  }

  private async communicationAgentEvaluation(answer: string): Promise<any> {
    const wordCount = answer.trim().split(/\s+/).length;

    const prompt = `Evaluate ONLY the communication quality of this interview answer:

ANSWER: ${answer}

WORD COUNT: ${wordCount}

CRITICAL: You MUST return ONLY valid JSON. No markdown, no explanations, ONLY the JSON object.

Return ONLY this JSON structure (no other text):
{
  "communicationClarity": <0-100>,
  "structureScore": <0-100>,
  "conciseness": <0-100>,
  "communicationStrengths": ["point1", "point2"],
  "communicationImprovements": ["area1", "area2"]
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are a communication assessment specialist. You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const result = this.safeJsonParse(responseText, {
        communicationClarity: 50,
        structureScore: 45,
        conciseness: 45,
        communicationStrengths: [],
        communicationImprovements: ['Unable to evaluate'],
      });

      if (wordCount < 20) {
        result.communicationClarity = Math.min(result.communicationClarity || 0, 40);
        result.structureScore = Math.min(result.structureScore || 0, 35);
        result.conciseness = Math.min(result.conciseness || 0, 30);
      }

      console.log('📊 Communication Assessment:', {
        wordCount,
        clarity: result.communicationClarity,
        structure: result.structureScore,
      });

      return result;
    } catch (error: any) {
      console.error('Communication evaluation error:', error);
      return {
        communicationClarity: 50,
        structureScore: 45,
        conciseness: 45,
        communicationStrengths: [],
        communicationImprovements: ['Evaluation failed'],
      };
    }
  }

  private async roleSpecificAgentEvaluation(
    question: string,
    answer: string,
    role: string,
    yearsOfExperience: number | string,
  ): Promise<any> {
    const experience = Number(yearsOfExperience) || 0;
    const wordCount = answer.trim().split(/\s+/).length;

    const prompt = `Evaluate role-specific competency for a ${role} with ${experience} years of experience.

QUESTION: ${question}
ANSWER: ${answer}

CRITICAL: You MUST return ONLY valid JSON. No markdown, no explanations, ONLY the JSON object.

Return ONLY this JSON structure (no other text):
{
  "relevanceToRole": <0-100>,
  "experienceLevelAlignment": <0-100>,
  "roleSpecificInsights": ["insight1", "insight2"],
  "missingCompetencies": ["area1", "area2"],
  "followUpQuestions": ["question1", "question2"]
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: `You are a ${role} hiring specialist. You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.` 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const result = this.safeJsonParse(responseText, {
        relevanceToRole: 50,
        experienceLevelAlignment: 45,
        roleSpecificInsights: [],
        missingCompetencies: ['Unable to evaluate'],
        followUpQuestions: [],
      });

      if (wordCount < 30) {
        result.relevanceToRole = Math.min(result.relevanceToRole || 0, 40);
        result.experienceLevelAlignment = Math.min(result.experienceLevelAlignment || 0, 35);
      }

      console.log('📊 Role-Specific Assessment:', {
        role,
        experience,
        wordCount,
        relevance: result.relevanceToRole,
        alignment: result.experienceLevelAlignment,
      });

      return result;
    } catch (error: any) {
      console.error('Role-specific evaluation error:', error);
      return {
        relevanceToRole: 50,
        experienceLevelAlignment: 45,
        roleSpecificInsights: [],
        missingCompetencies: ['Evaluation failed'],
        followUpQuestions: [],
      };
    }
  }

  private synthesizeEvaluations(
    technical: any,
    communication: any,
    roleSpecific: any,
    answer: string,
  ): DetailedEvaluation {
    const wordCount = answer.trim().split(/\s+/).length;

    const rawScore = Math.round(
      (technical.technicalAccuracy * 0.30) +
      (technical.depthOfKnowledge * 0.20) +
      (technical.problemSolvingApproach * 0.15) +
      (communication.communicationClarity * 0.15) +
      (roleSpecific.relevanceToRole * 0.20)
    );

    let overallScore = rawScore;
    const penalties: string[] = [];

    if (wordCount < 10) {
      overallScore = Math.min(overallScore, 15);
      penalties.push('Extremely brief answer');
    } else if (wordCount < 20) {
      overallScore = Math.min(overallScore, 35);
      penalties.push('Very brief answer');
    } else if (wordCount < 40) {
      overallScore = Math.min(overallScore, 55);
      penalties.push('Brief answer - needs more detail');
    }

    const genericPatterns = /^(hello|hi|yes|no|okay|ok|sure|maybe|i think|um|uh)[\s.,!?]*$/i;
    if (genericPatterns.test(answer.trim()) || wordCount < 5) {
      overallScore = Math.min(overallScore, 10);
      penalties.push('Generic or trivial response');
    }

    const lowScores = [
      technical.technicalAccuracy,
      technical.depthOfKnowledge,
      communication.communicationClarity,
      roleSpecific.relevanceToRole,
    ].filter((s: number) => s < 40);

    if (lowScores.length >= 2) {
      overallScore = Math.min(overallScore, 45);
    }

    let confidence: 'low' | 'medium' | 'high' = 'medium';
    const scoreVariance = Math.max(
      technical.technicalAccuracy,
      communication.communicationClarity,
      roleSpecific.relevanceToRole,
    ) - Math.min(
      technical.technicalAccuracy,
      communication.communicationClarity,
      roleSpecific.relevanceToRole,
    );

    if (wordCount < 15 || overallScore < 35 || scoreVariance > 40) {
      confidence = 'low';
    } else if (wordCount > 80 && overallScore > 75 && scoreVariance < 20) {
      confidence = 'high';
    }

    const feedback = this.generateSynthesizedFeedback(
      overallScore,
      technical,
      communication,
      roleSpecific,
      wordCount,
      penalties,
    );

    return {
      overallScore,
      technicalAccuracy: technical.technicalAccuracy || 0,
      communicationClarity: communication.communicationClarity || 0,
      depthOfKnowledge: technical.depthOfKnowledge || 0,
      problemSolvingApproach: technical.problemSolvingApproach || 0,
      relevanceToRole: roleSpecific.relevanceToRole || 0,
      feedback,
      strengths: [
        ...(technical.technicalStrengths || []),
        ...(communication.communicationStrengths || []),
      ].filter((s: string) => s && s.length > 0),
      improvements: [
        ...(technical.technicalGaps || []),
        ...(communication.communicationImprovements || []),
        ...(roleSpecific.missingCompetencies || []),
        ...penalties,
      ].filter((i: string) => i && i.length > 0),
      keyInsights: (roleSpecific.roleSpecificInsights || []).filter((i: string) => i && i.length > 0),
      wordCount,
      confidence,
      redFlags: (technical.redFlags || []).filter((f: string) => f && f.length > 0),
      followUpQuestions: (roleSpecific.followUpQuestions || []).filter((q: string) => q && q.length > 0),
    };
  }

  private generateSynthesizedFeedback(
    score: number,
    technical: any,
    communication: any,
    roleSpecific: any,
    wordCount: number,
    penalties: string[],
  ): string {
    if (wordCount < 10) {
      return 'Answer is too brief and lacks substance. Please provide detailed, thoughtful responses that demonstrate your knowledge and experience. Aim for at least 40-50 words per answer.';
    }

    if (score < 25) {
      return 'Answer does not adequately address the question. Please listen carefully to the question and provide specific, relevant examples from your experience. Generic responses receive low scores.';
    }

    if (score >= 85) {
      return 'Excellent answer! You demonstrated strong technical knowledge, clear communication, and relevant experience. Your response was well-structured with specific examples.';
    } else if (score >= 70) {
      return 'Good answer with solid foundations. You showed understanding of the topic, though adding more specific examples or technical depth would strengthen your response.';
    } else if (score >= 55) {
      return 'Adequate answer but lacks sufficient depth. Focus on providing concrete examples, explaining your reasoning, and demonstrating deeper technical knowledge for your experience level.';
    } else if (score >= 40) {
      return 'Answer needs improvement. Provide more detailed explanations, specific examples from your experience, and demonstrate clearer understanding of the concepts being discussed.';
    } else {
      return 'Answer requires significant improvement. Focus on: (1) directly addressing the question asked, (2) providing specific examples, (3) demonstrating relevant technical knowledge, and (4) giving more detailed responses (40+ words).';
    }
  }

  private getFallbackEvaluation(answer: string): DetailedEvaluation {
    const wordCount = answer.split(/\s+/).length;
    return {
      overallScore: 70,
      technicalAccuracy: 70,
      communicationClarity: 75,
      depthOfKnowledge: 65,
      problemSolvingApproach: 70,
      relevanceToRole: 70,
      feedback: 'Answer received and evaluated. More detail would strengthen your response.',
      strengths: ['Clear communication', 'Addressed the question'],
      improvements: ['Provide more specific examples', 'Add technical depth'],
      keyInsights: [],
      wordCount,
      confidence: 'medium',
      redFlags: [],
      followUpQuestions: [],
    };
  }

  async textToSpeech(text: string): Promise<Buffer> {
    try {
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        speed: 1.0,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    } catch (error: any) {
      console.error('OpenAI TTS error:', error.message);
      throw new Error('Text-to-speech failed');
    }
  }
}