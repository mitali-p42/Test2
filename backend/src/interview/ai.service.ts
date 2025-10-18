// backend/src/interview/ai.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// 🆕 Enhanced Evaluation Result Type
export interface DetailedEvaluation {
  // Overall Metrics
  overallScore: number;          // 0-100
  
  // Dimension Scores (0-100 each)
  technicalAccuracy: number;
  communicationClarity: number;
  depthOfKnowledge: number;
  problemSolvingApproach: number;
  relevanceToRole: number;
  
  // Qualitative Assessment
  feedback: string;
  strengths: string[];
  improvements: string[];
  keyInsights: string[];
  
  // Metadata
  wordCount: number;
  answerDuration?: number;
  confidence: 'low' | 'medium' | 'high';
  
  // Red Flags
  redFlags: string[];
  
  // Recommendations
  followUpQuestions: string[];
}

// Question categories for diversity
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

  // 🆕 Get diverse question category based on question number
  private getQuestionCategory(questionNumber: number): string {
    const categories = Object.keys(QUESTION_CATEGORIES);
    const categoryIndex = (questionNumber - 1) % categories.length;
    return categories[categoryIndex];
  }

  // 🆕 Get random starter from category
  private getRandomStarter(category: string): string {
    const starters = QUESTION_CATEGORIES[category as keyof typeof QUESTION_CATEGORIES] || [];
    return starters[Math.floor(Math.random() * starters.length)] || '';
  }

  // 🎤 STT: Transcribe audio using Groq Whisper
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

  // 🤖 LLM: Generate diverse interview questions with better prompts
  async generateQuestion(
    role: string,
    interviewType: string,
    yearsOfExperience: number | string,
    questionNumber: number,
  ): Promise<string> {
    try {
      const category = this.getQuestionCategory(questionNumber);
      const starter = this.getRandomStarter(category);

      // 🆕 Enhanced diverse prompt
      const prompt = `You are conducting a professional ${interviewType} interview for a ${role} position.

CANDIDATE PROFILE:
- Experience Level: ${yearsOfExperience} years
- Target Role: ${role}
- Interview Type: ${interviewType}

QUESTION ${questionNumber}/5 REQUIREMENTS:
📋 Category: ${category.toUpperCase()}
🎯 Focus Area: ${this.getCategoryGuidance(category, role, interviewType)}
💡 Starter Template: "${starter}"

INSTRUCTIONS:
1. Create a unique, thought-provoking question
2. Tailor complexity to ${yearsOfExperience} years of experience
3. Make it ${category}-focused and role-specific
4. Keep it conversational (40-60 words)
5. Avoid generic questions - be specific to ${role}
6. Ensure the question tests real competency

DIVERSITY REQUIREMENTS:
- Use varied question structures
- Mix open-ended with scenario-based approaches
- Include real-world context when possible
- Make each question distinct from others

Generate ONE clear, focused question (no numbering or preamble):`;

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert interviewer specializing in ${category} assessment. Generate diverse, insightful questions that reveal true candidate capabilities.` 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.85, // High diversity
        top_p: 0.9,
        max_tokens: 180,
      });

      const question = completion.choices[0]?.message?.content?.trim();
      return question || this.getFallbackQuestion(category, role, questionNumber);
    } catch (error: any) {
      console.error('Groq LLM error:', error.message);
      return this.getFallbackQuestion('technical', role, questionNumber);
    }
  }

  // Category-specific guidance
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

  // Fallback questions by category
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

  // 🎯 ENHANCED: Multi-Agent Evaluation System
  async evaluateAnswer(
    question: string,
    answer: string,
    role: string,
    yearsOfExperience: number | string,
    questionNumber: number,
  ): Promise<DetailedEvaluation> {
    try {
      console.log('🤖 Starting multi-agent evaluation...');

      // Agent 1: Technical Assessor
      const technicalAssessment = await this.technicalAgentEvaluation(
        question,
        answer,
        role,
        yearsOfExperience,
      );

      // Agent 2: Communication Assessor
      const communicationAssessment = await this.communicationAgentEvaluation(answer);

      // Agent 3: Role-Specific Assessor
      const roleAssessment = await this.roleSpecificAgentEvaluation(
        question,
        answer,
        role,
        yearsOfExperience,
      );

      // Synthesize all assessments
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

  // 🤖 Agent 1: Technical Assessment
//   private async technicalAgentEvaluation(
//     question: string,
//     answer: string,
//     role: string,
//     yearsOfExperience: number | string,
//   ): Promise<any> {
//     const prompt = `You are a technical interviewer evaluating a ${role} candidate with ${yearsOfExperience} years of experience.

// QUESTION: ${question}

// ANSWER: ${answer}

// Evaluate ONLY the technical aspects. Return JSON:
// {
//   "technicalAccuracy": <0-100>,
//   "depthOfKnowledge": <0-100>,
//   "problemSolvingApproach": <0-100>,
//   "technicalStrengths": ["point1", "point2"],
//   "technicalGaps": ["gap1", "gap2"],
//   "redFlags": ["flag1"] or []
// }`;

//     const completion = await this.groq.chat.completions.create({
//       model: 'llama-3.3-70b-versatile',
//       messages: [
//         { role: 'system', content: 'You are a technical assessment specialist. Evaluate rigorously and honestly.' },
//         { role: 'user', content: prompt },
//       ],
//       temperature: 0.3,
//       max_tokens: 500,
//     });

//     return JSON.parse(completion.choices[0]?.message?.content || '{}');
//   }
  // 🤖 Agent 1: ENHANCED Technical Assessment
private async technicalAgentEvaluation(
  question: string,
  answer: string,
  role: string,
  yearsOfExperience: number | string,
): Promise<any> {
  // Calculate expected answer length based on experience
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

CRITICAL EVALUATION CRITERIA:
1. **Answer Relevance**: Does the answer actually address the question asked? (Weight: 40%)
2. **Technical Depth**: Does the answer demonstrate appropriate technical knowledge for ${yearsOfExperience} years of experience? (Weight: 30%)
3. **Completeness**: Is the answer sufficiently detailed and complete? (Weight: 20%)
4. **Clarity**: Is the answer well-structured and easy to understand? (Weight: 10%)

SCORING RULES:
- If answer is < ${minExpectedWords} words: Maximum score is 40
- If answer is generic ("hello", "yes", "okay", one-word answers): Maximum score is 15
- If answer does NOT address the question: Maximum score is 20
- If answer lacks technical depth for experience level: Reduce score by 30-50 points
- If answer is vague or circular: Reduce score by 20-30 points

EXPERIENCE-BASED EXPECTATIONS:
- 0-2 years: Basic understanding, some hesitation acceptable
- 3-5 years: Solid technical knowledge, clear examples expected
- 6+ years: Deep expertise, strategic thinking, best practices expected

Return JSON:
{
  "technicalAccuracy": <0-100>,
  "depthOfKnowledge": <0-100>,
  "problemSolvingApproach": <0-100>,
  "technicalStrengths": ["specific strength 1", "specific strength 2"],
  "technicalGaps": ["specific gap 1", "specific gap 2"],
  "redFlags": ["flag1 if serious issues"] or [],
  "reasoning": "Brief explanation of score"
}

BE STRICT. A great answer should score 80+. An average answer scores 60-70. A poor answer scores below 50.`;

  try {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: `You are a strict technical assessment specialist. You evaluate rigorously based on answer quality, relevance, and depth. Do not give high scores to generic, short, or irrelevant answers.` 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2, // Lower temperature for consistency
      max_tokens: 600,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    
    // 🆕 Additional validation: Cap scores for obviously poor answers
    if (answerWordCount < minExpectedWords) {
      result.technicalAccuracy = Math.min(result.technicalAccuracy || 0, 40);
      result.depthOfKnowledge = Math.min(result.depthOfKnowledge || 0, 35);
      result.problemSolvingApproach = Math.min(result.problemSolvingApproach || 0, 35);
      if (!result.redFlags) result.redFlags = [];
      result.redFlags.push(`Answer too brief (${answerWordCount} words, expected ${minExpectedWords}+)`);
    }

    // 🆕 Detect generic answers
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
    throw error;
  }
}

  // 🤖 Agent 2: Communication Assessment
//   private async communicationAgentEvaluation(answer: string): Promise<any> {
//     const prompt = `Evaluate ONLY the communication quality of this interview answer:

// ANSWER: ${answer}

// Assess clarity, structure, and articulation. Return JSON:
// {
//   "communicationClarity": <0-100>,
//   "structureScore": <0-100>,
//   "conciseness": <0-100>,
//   "communicationStrengths": ["point1", "point2"],
//   "communicationImprovements": ["area1", "area2"]
// }`;

//     const completion = await this.groq.chat.completions.create({
//       model: 'llama-3.3-70b-versatile',
//       messages: [
//         { role: 'system', content: 'You are a communication assessment specialist.' },
//         { role: 'user', content: prompt },
//       ],
//       temperature: 0.3,
//       max_tokens: 400,
//     });

//     return JSON.parse(completion.choices[0]?.message?.content || '{}');
//   }
  // 🤖 Agent 2: ENHANCED Communication Assessment
private async communicationAgentEvaluation(answer: string): Promise<any> {
  const wordCount = answer.trim().split(/\s+/).length;

  const prompt = `Evaluate ONLY the communication quality of this interview answer:

ANSWER: ${answer}

WORD COUNT: ${wordCount}

Assess clarity, structure, and articulation based on professional interview standards.

SCORING GUIDELINES:
- Excellent (85-100): Clear, well-structured, professional, easy to follow
- Good (70-84): Generally clear, some structure, understandable
- Fair (55-69): Somewhat unclear, lacks structure, requires effort to understand
- Poor (40-54): Unclear, disorganized, difficult to follow
- Very Poor (0-39): Incoherent, generic responses, minimal content

PENALTIES:
- If answer is < 20 words: Maximum score 40
- If answer is generic/trivial: Maximum score 20
- If answer lacks structure: Reduce by 15-20 points

Return JSON:
{
  "communicationClarity": <0-100>,
  "structureScore": <0-100>,
  "conciseness": <0-100>,
  "communicationStrengths": ["strength1", "strength2"],
  "communicationImprovements": ["area1", "area2"]
}`;

  try {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a communication assessment specialist. Be strict - only excellent answers deserve high scores.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

    // 🆕 Additional validation for poor communication
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
    throw error;
  }
  }

  // 🤖 Agent 3: Role-Specific Assessment
//   private async roleSpecificAgentEvaluation(
//     question: string,
//     answer: string,
//     role: string,
//     yearsOfExperience: number | string,
//   ): Promise<any> {
//     const prompt = `You are evaluating how well this answer demonstrates ${role} competency.

// Expected experience level: ${yearsOfExperience} years

// QUESTION: ${question}
// ANSWER: ${answer}

// Evaluate role-specific fit and competency. Return JSON:
// {
//   "relevanceToRole": <0-100>,
//   "experienceLevelAlignment": <0-100>,
//   "roleSpecificInsights": ["insight1", "insight2"],
//   "missingCompetencies": ["area1", "area2"],
//   "followUpQuestions": ["question1", "question2"]
// }`;

//     const completion = await this.groq.chat.completions.create({
//       model: 'llama-3.3-70b-versatile',
//       messages: [
//         { role: 'system', content: `You are a ${role} hiring specialist with deep domain expertise.` },
//         { role: 'user', content: prompt },
//       ],
//       temperature: 0.4,
//       max_tokens: 500,
//     });

//     return JSON.parse(completion.choices[0]?.message?.content || '{}');
//   }
  // 🤖 Agent 3: ENHANCED Role-Specific Assessment
// private async roleSpecificAgentEvaluation(
//   question: string,
//   answer: string,
//   role: string,
//   yearsOfExperience: number | string,
// ): Promise<any> {
//   const experience = Number(yearsOfExperience) || 0;
//   const wordCount = answer.trim().split(/\s+/).length;

//   const prompt = `You are evaluating how well this answer demonstrates ${role} competency for someone with ${yearsOfExperience} years of experience.

// QUESTION ASKED:
// ${question}

// CANDIDATE'S ANSWER:
// ${answer}

// ANSWER LENGTH: ${wordCount} words

// EVALUATION FOCUS:
// 1. Does the answer demonstrate actual ${role} experience and knowledge?
// 2. Is the answer appropriate for ${yearsOfExperience} years of experience?
// 3. Does the answer show role-specific competencies?
// 4. Are there concrete examples or just generic statements?

// SCORING STRICTNESS:
// - Generic answers (no specific examples): Maximum 30
// - Off-topic answers: Maximum 25
// - Brief answers (< 30 words): Maximum 40
// - Vague answers without substance: Maximum 50
// - Good answers with examples: 70-85
// - Exceptional answers showing deep expertise: 85-100

// Expected depth for ${yearsOfExperience} years:
// ${
//   Number(yearsOfExperience) < 2
//     ? '- Should show basic understanding\n- Examples from learning/school projects acceptable\n- Some hesitation or uncertainty is normal'
//     : Number(yearsOfExperience) < 5
//     ? '- Should demonstrate practical experience\n- Real-world examples expected\n- Shows understanding of trade-offs'
//     : '- Should show deep expertise and strategic thinking\n- Multiple examples across different scenarios\n- Discusses best practices and industry standards'
// }

// Return JSON:
// {
//   "relevanceToRole": <0-100>,
//   "experienceLevelAlignment": <0-100>,
//   "roleSpecificInsights": ["specific insight1", "specific insight2"],
//   "missingCompetencies": ["what's missing1", "what's missing2"],
//   "followUpQuestions": ["follow-up1", "follow-up2"]
// }`;

//   try {
//     const completion = await this.groq.chat.completions.create({
//       model: 'llama-3.3-70b-versatile',
//       messages: [
//         { 
//           role: 'system', 
//           content: `You are a ${role} hiring specialist with deep domain expertise. You evaluate candidates strictly based on role-specific competency and experience level. Generic answers receive low scores.` 
//         },
//         { role: 'user', content: prompt },
//       ],
//       temperature: 0.3,
//       max_tokens: 600,
//     });

//     const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

//     // 🆕 Validate role relevance
//     if (wordCount < 30) {
//       result.relevanceToRole = Math.min(result.relevanceToRole || 0, 40);
//       result.experienceLevelAlignment = Math.min(result.experienceLevelAlignment || 0, 35);
//     }

//     console.log('📊 Role-Specific Assessment:', {
//       role,
//       experience: yearsOfExperience,
//       wordCount,
//       relevance: result.relevanceToRole,
//       alignment: result.experienceLevelAlignment,
//     });

//     return result;
//   } catch (error: any) {
//     console.error('Role-specific evaluation error:', error);
//     throw error;
//   }
//   }
  // 🤖 Agent 3: ENHANCED Role-Specific Assessment
private async roleSpecificAgentEvaluation(
  question: string,
  answer: string,
  role: string,
  yearsOfExperience: number | string,
): Promise<any> {
  // 🔧 FIX: Convert to number
  const experience = Number(yearsOfExperience) || 0;
  const wordCount = answer.trim().split(/\s+/).length;

  const prompt = `You are evaluating how well this answer demonstrates ${role} competency for someone with ${experience} years of experience.

QUESTION ASKED:
${question}

CANDIDATE'S ANSWER:
${answer}

ANSWER LENGTH: ${wordCount} words

EVALUATION FOCUS:
1. Does the answer demonstrate actual ${role} experience and knowledge?
2. Is the answer appropriate for ${experience} years of experience?
3. Does the answer show role-specific competencies?
4. Are there concrete examples or just generic statements?

SCORING STRICTNESS:
- Generic answers (no specific examples): Maximum 30
- Off-topic answers: Maximum 25
- Brief answers (< 30 words): Maximum 40
- Vague answers without substance: Maximum 50
- Good answers with examples: 70-85
- Exceptional answers showing deep expertise: 85-100

Expected depth for ${experience} years:
${
  experience < 2
    ? '- Should show basic understanding\n- Examples from learning/school projects acceptable\n- Some hesitation or uncertainty is normal'
    : experience < 5
    ? '- Should demonstrate practical experience\n- Real-world examples expected\n- Shows understanding of trade-offs'
    : '- Should show deep expertise and strategic thinking\n- Multiple examples across different scenarios\n- Discusses best practices and industry standards'
}

Return JSON:
{
  "relevanceToRole": <0-100>,
  "experienceLevelAlignment": <0-100>,
  "roleSpecificInsights": ["specific insight1", "specific insight2"],
  "missingCompetencies": ["what's missing1", "what's missing2"],
  "followUpQuestions": ["follow-up1", "follow-up2"]
}`;

  try {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: `You are a ${role} hiring specialist with deep domain expertise. You evaluate candidates strictly based on role-specific competency and experience level. Generic answers receive low scores.` 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

    // 🆕 Validate role relevance
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
    throw error;
  }
}
  // 🎯 Synthesize all agent evaluations
  // 🎯 ENHANCED: Synthesize all agent evaluations with stricter thresholds
// private synthesizeEvaluations(
//   technical: any,
//   communication: any,
//   roleSpecific: any,
//   answer: string,
// ): DetailedEvaluation {
//   const wordCount = answer.trim().split(/\s+/).length;

//   // 🆕 Stricter weighted calculation
//   const rawScore = Math.round(
//     (technical.technicalAccuracy * 0.30) +
//     (technical.depthOfKnowledge * 0.20) +
//     (technical.problemSolvingApproach * 0.15) +
//     (communication.communicationClarity * 0.15) +
//     (roleSpecific.relevanceToRole * 0.20)
//   );

//   // 🆕 Apply penalties for poor answers
//   let overallScore = rawScore;
//   const penalties: string[] = [];

//   // Penalty for very short answers
//   if (wordCount < 10) {
//     overallScore = Math.min(overallScore, 15);
//     penalties.push('Extremely brief answer');
//   } else if (wordCount < 20) {
//     overallScore = Math.min(overallScore, 35);
//     penalties.push('Very brief answer');
//   } else if (wordCount < 40) {
//     overallScore = Math.min(overallScore, 55);
//     penalties.push('Brief answer - needs more detail');
//   }

//   // Penalty for generic content
//   const genericPatterns = /^(hello|hi|yes|no|okay|ok|sure|maybe|i think|um|uh)[\s.,!?]*$/i;
//   if (genericPatterns.test(answer.trim()) || wordCount < 5) {
//     overallScore = Math.min(overallScore, 10);
//     penalties.push('Generic or trivial response');
//   }

//   // Cap at reasonable maximum if multiple low scores
//   const lowScores = [
//     technical.technicalAccuracy,
//     technical.depthOfKnowledge,
//     communication.communicationClarity,
//     roleSpecific.relevanceToRole,
//   ].filter(s => s < 40);

//   if (lowScores.length >= 2) {
//     overallScore = Math.min(overallScore, 45);
//   }

//   // Determine confidence based on answer quality and consistency
//   let confidence: 'low' | 'medium' | 'high' = 'medium';
//   const scoreVariance = Math.max(
//     technical.technicalAccuracy,
//     communication.communicationClarity,
//     roleSpecific.relevanceToRole,
//   ) - Math.min(
//     technical.technicalAccuracy,
//     communication.communicationClarity,
//     roleSpecific.relevanceToRole,
//   );

//   if (wordCount < 15 || overallScore < 35 || scoreVariance > 40) {
//     confidence = 'low';
//   } else if (wordCount > 80 && overallScore > 75 && scoreVariance < 20) {
//     confidence = 'high';
//   }

//   // 🆕 Enhanced feedback generation
//   const feedback = this.generateSynthesizedFeedback(
//     overallScore,
//     technical,
//     communication,
//     roleSpecific,
//     wordCount,
//     penalties,
//   );

//   return {
//     overallScore,
//     technicalAccuracy: technical.technicalAccuracy || 0,
//     communicationClarity: communication.communicationClarity || 0,
//     depthOfKnowledge: technical.depthOfKnowledge || 0,
//     problemSolvingApproach: technical.problemSolvingApproach || 0,
//     relevanceToRole: roleSpecific.relevanceToRole || 0,
//     feedback,
//     strengths: [
//       ...(technical.technicalStrengths || []),
//       ...(communication.communicationStrengths || []),
//     ].filter(s => s && s.length > 0),
//     improvements: [
//       ...(technical.technicalGaps || []),
//       ...(communication.communicationImprovements || []),
//       ...(roleSpecific.missingCompetencies || []),
//       ...penalties,
//     ].filter(i => i && i.length > 0),
//     keyInsights: (roleSpecific.roleSpecificInsights || []).filter(i => i && i.length > 0),
//     wordCount,
//     confidence,
//     redFlags: (technical.redFlags || []).filter(f => f && f.length > 0),
//     followUpQuestions: (roleSpecific.followUpQuestions || []).filter(q => q && q.length > 0),
//   };
// }
  // 🎯 ENHANCED: Synthesize all agent evaluations with stricter thresholds
private synthesizeEvaluations(
  technical: any,
  communication: any,
  roleSpecific: any,
  answer: string,
): DetailedEvaluation {
  const wordCount = answer.trim().split(/\s+/).length;

  // 🆕 Stricter weighted calculation
  const rawScore = Math.round(
    (technical.technicalAccuracy * 0.30) +
    (technical.depthOfKnowledge * 0.20) +
    (technical.problemSolvingApproach * 0.15) +
    (communication.communicationClarity * 0.15) +
    (roleSpecific.relevanceToRole * 0.20)
  );

  // 🆕 Apply penalties for poor answers
  let overallScore = rawScore;
  const penalties: string[] = [];

  // Penalty for very short answers
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

  // Penalty for generic content
  const genericPatterns = /^(hello|hi|yes|no|okay|ok|sure|maybe|i think|um|uh)[\s.,!?]*$/i;
  if (genericPatterns.test(answer.trim()) || wordCount < 5) {
    overallScore = Math.min(overallScore, 10);
    penalties.push('Generic or trivial response');
  }

  // Cap at reasonable maximum if multiple low scores
  const lowScores = [
    technical.technicalAccuracy,
    technical.depthOfKnowledge,
    communication.communicationClarity,
    roleSpecific.relevanceToRole,
  ].filter((s: number) => s < 40);

  if (lowScores.length >= 2) {
    overallScore = Math.min(overallScore, 45);
  }

  // Determine confidence based on answer quality and consistency
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

  // 🆕 Enhanced feedback generation
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

// 🆕 Enhanced feedback generation
private generateSynthesizedFeedback(
  score: number,
  technical: any,
  communication: any,
  roleSpecific: any,
  wordCount: number,
  penalties: string[],
): string {
  // Critical issues feedback
  if (wordCount < 10) {
    return 'Answer is too brief and lacks substance. Please provide detailed, thoughtful responses that demonstrate your knowledge and experience. Aim for at least 40-50 words per answer.';
  }

  if (score < 25) {
    return 'Answer does not adequately address the question. Please listen carefully to the question and provide specific, relevant examples from your experience. Generic responses receive low scores.';
  }

  // Score-based feedback
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

  // Generate synthesized feedback
  // private generateSynthesizedFeedback(
  //   score: number,
  //   technical: any,
  //   communication: any,
  //   roleSpecific: any,
  // ): string {
  //   if (score >= 85) {
  //     return 'Excellent answer demonstrating strong technical knowledge, clear communication, and role alignment. Shows depth of understanding and practical experience.';
  //   } else if (score >= 70) {
  //     return 'Good answer with solid foundations. Some areas could be strengthened with more specific examples or deeper technical detail.';
  //   } else if (score >= 55) {
  //     return 'Adequate answer but lacks depth in key areas. Would benefit from more structured approach and concrete examples.';
  //   } else {
  //     return 'Answer needs significant improvement. Consider providing more specific examples, technical details, and demonstrating clearer understanding of the question.';
  //   }
  // }

  // Fallback evaluation
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

  // 🔊 TTS: Convert text to speech using OpenAI
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