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
  private async technicalAgentEvaluation(
    question: string,
    answer: string,
    role: string,
    yearsOfExperience: number | string,
  ): Promise<any> {
    const prompt = `You are a technical interviewer evaluating a ${role} candidate with ${yearsOfExperience} years of experience.

QUESTION: ${question}

ANSWER: ${answer}

Evaluate ONLY the technical aspects. Return JSON:
{
  "technicalAccuracy": <0-100>,
  "depthOfKnowledge": <0-100>,
  "problemSolvingApproach": <0-100>,
  "technicalStrengths": ["point1", "point2"],
  "technicalGaps": ["gap1", "gap2"],
  "redFlags": ["flag1"] or []
}`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a technical assessment specialist. Evaluate rigorously and honestly.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  }

  // 🤖 Agent 2: Communication Assessment
  private async communicationAgentEvaluation(answer: string): Promise<any> {
    const prompt = `Evaluate ONLY the communication quality of this interview answer:

ANSWER: ${answer}

Assess clarity, structure, and articulation. Return JSON:
{
  "communicationClarity": <0-100>,
  "structureScore": <0-100>,
  "conciseness": <0-100>,
  "communicationStrengths": ["point1", "point2"],
  "communicationImprovements": ["area1", "area2"]
}`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a communication assessment specialist.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  }

  // 🤖 Agent 3: Role-Specific Assessment
  private async roleSpecificAgentEvaluation(
    question: string,
    answer: string,
    role: string,
    yearsOfExperience: number | string,
  ): Promise<any> {
    const prompt = `You are evaluating how well this answer demonstrates ${role} competency.

Expected experience level: ${yearsOfExperience} years

QUESTION: ${question}
ANSWER: ${answer}

Evaluate role-specific fit and competency. Return JSON:
{
  "relevanceToRole": <0-100>,
  "experienceLevelAlignment": <0-100>,
  "roleSpecificInsights": ["insight1", "insight2"],
  "missingCompetencies": ["area1", "area2"],
  "followUpQuestions": ["question1", "question2"]
}`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are a ${role} hiring specialist with deep domain expertise.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  }

  // 🎯 Synthesize all agent evaluations
  private synthesizeEvaluations(
    technical: any,
    communication: any,
    roleSpecific: any,
    answer: string,
  ): DetailedEvaluation {
    // Calculate weighted overall score
    const overallScore = Math.round(
      (technical.technicalAccuracy * 0.30) +
      (technical.depthOfKnowledge * 0.20) +
      (technical.problemSolvingApproach * 0.15) +
      (communication.communicationClarity * 0.15) +
      (roleSpecific.relevanceToRole * 0.20)
    );

    // Determine confidence based on answer quality
    const wordCount = answer.split(/\s+/).length;
    let confidence: 'low' | 'medium' | 'high' = 'medium';
    if (wordCount < 20) confidence = 'low';
    else if (wordCount > 100 && overallScore > 70) confidence = 'high';

    // Synthesize feedback
    const feedback = this.generateSynthesizedFeedback(overallScore, technical, communication, roleSpecific);

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
      ],
      improvements: [
        ...(technical.technicalGaps || []),
        ...(communication.communicationImprovements || []),
        ...(roleSpecific.missingCompetencies || []),
      ],
      keyInsights: roleSpecific.roleSpecificInsights || [],
      wordCount,
      confidence,
      redFlags: technical.redFlags || [],
      followUpQuestions: roleSpecific.followUpQuestions || [],
    };
  }

  // Generate synthesized feedback
  private generateSynthesizedFeedback(
    score: number,
    technical: any,
    communication: any,
    roleSpecific: any,
  ): string {
    if (score >= 85) {
      return 'Excellent answer demonstrating strong technical knowledge, clear communication, and role alignment. Shows depth of understanding and practical experience.';
    } else if (score >= 70) {
      return 'Good answer with solid foundations. Some areas could be strengthened with more specific examples or deeper technical detail.';
    } else if (score >= 55) {
      return 'Adequate answer but lacks depth in key areas. Would benefit from more structured approach and concrete examples.';
    } else {
      return 'Answer needs significant improvement. Consider providing more specific examples, technical details, and demonstrating clearer understanding of the question.';
    }
  }

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