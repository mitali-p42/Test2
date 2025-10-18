// backend/src/interview/interview.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewSession, InterviewStatus } from './interview-session.entity';
import { InterviewQA } from './interview-qa.entity';
import { AIService, DetailedEvaluation } from './ai.service';

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,
    @InjectRepository(InterviewQA)
    private readonly qaRepo: Repository<InterviewQA>,
    private readonly aiService: AIService,
  ) {}

  async createSession(
    userId: string,
    role: string,
    interviewType: string,
    yearsOfExperience?: number,
  ) {
    const session = this.sessionRepo.create({
      userId,
      role,
      interviewType,
      status: InterviewStatus.PENDING,
      totalQuestions: 5,
      currentQuestionIndex: 0,
    });
    return this.sessionRepo.save(session);
  }

  async startSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    session.status = InterviewStatus.IN_PROGRESS;
    session.startedAt = new Date();
    return this.sessionRepo.save(session);
  }

  async getSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  // 🆕 Generate next question with category tracking
  async generateNextQuestion(
    sessionId: string,
    yearsOfExperience: number | string = 0,
  ): Promise<{ question: string; questionNumber: number; audioBuffer: Buffer; category: string }> {
    const session = await this.getSession(sessionId);
    const nextNumber = session.currentQuestionIndex + 1;

    if (nextNumber > session.totalQuestions) {
      throw new Error('Interview completed');
    }

    // 🆕 Determine question category
    const categories = ['behavioral', 'technical', 'situational', 'competency', 'problemSolving'];
    const category = categories[(nextNumber - 1) % categories.length];

    console.log(`📝 Generating question ${nextNumber} - Category: ${category}`);

    // Generate diverse question using AI
    const question = await this.aiService.generateQuestion(
      session.role,
      session.interviewType,
      yearsOfExperience,
      nextNumber,
    );

    // Save question to DB with category
    await this.saveQA(sessionId, session.userId, nextNumber, question, category);

    // Generate audio for question
    const audioBuffer = await this.aiService.textToSpeech(question);

    // Update current question index
    session.currentQuestionIndex = nextNumber;
    await this.sessionRepo.save(session);

    return { question, questionNumber: nextNumber, audioBuffer, category };
  }

  // 🆕 Process answer with enhanced multi-agent evaluation
  async processAnswer(
    sessionId: string,
    questionNumber: number,
    audioBuffer: Buffer,
    yearsOfExperience: number | string = 0,
  ): Promise<{ transcript: string; evaluation: DetailedEvaluation }> {
    console.log('🔍 Processing answer:', { sessionId, questionNumber });

    // Transcribe audio
    const startTime = Date.now();
    const transcript = await this.aiService.transcribeAudio(
      audioBuffer,
      `answer-${Date.now()}.webm`,
    );
    const answerDuration = Math.round((Date.now() - startTime) / 1000);

    // Get the question
    const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
    if (!qa) {
      const allQAs = await this.qaRepo.find({ where: { sessionId } });
      console.error('❌ Question not found!', {
        sessionId,
        questionNumber,
        existingQuestions: allQAs.map((q) => q.questionNumber),
      });
      throw new NotFoundException(
        `Question ${questionNumber} not found for session ${sessionId}. ` +
          `Available questions: ${allQAs.map((q) => q.questionNumber).join(', ')}`,
      );
    }

    // Get session for role info
    const session = await this.getSession(sessionId);

    console.log('🤖 Starting multi-agent evaluation...');

    // 🆕 Enhanced evaluation with multiple agents
    const evaluation = await this.aiService.evaluateAnswer(
      qa.question,
      transcript,
      session.role,
      yearsOfExperience,
      questionNumber,
    );

    console.log('✅ Evaluation complete:', {
      overallScore: evaluation.overallScore,
      confidence: evaluation.confidence,
      dimensions: {
        technical: evaluation.technicalAccuracy,
        communication: evaluation.communicationClarity,
        depth: evaluation.depthOfKnowledge,
        problemSolving: evaluation.problemSolvingApproach,
        roleRelevance: evaluation.relevanceToRole,
      },
    });

    // 🆕 Update QA record with detailed evaluation
    qa.answer = transcript;
    qa.transcript = transcript;
    
    // Store all evaluation dimensions
    qa.overallScore = evaluation.overallScore;
    qa.technicalAccuracy = evaluation.technicalAccuracy;
    qa.communicationClarity = evaluation.communicationClarity;
    qa.depthOfKnowledge = evaluation.depthOfKnowledge;
    qa.problemSolvingApproach = evaluation.problemSolvingApproach;
    qa.relevanceToRole = evaluation.relevanceToRole;
    
    // Store qualitative assessment
    qa.feedback = evaluation.feedback;
    qa.strengths = evaluation.strengths;
    qa.improvements = evaluation.improvements;
    qa.keyInsights = evaluation.keyInsights;
    
    // Store metadata
    qa.wordCount = evaluation.wordCount;
    qa.answerDurationSeconds = answerDuration;
    qa.confidence = evaluation.confidence;
    
    // Store red flags and follow-ups
    qa.redFlags = evaluation.redFlags;
    qa.followUpQuestions = evaluation.followUpQuestions;
    
    // Legacy JSONB field for backward compatibility
    qa.evaluation = {
      score: evaluation.overallScore,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
    };

    await this.qaRepo.save(qa);

    return { transcript, evaluation };
  }

  // 🆕 Save QA with user_id and category
  async saveQA(
    sessionId: string,
    userId: string,
    questionNumber: number,
    question: string,
    category?: string,
    answer?: string,
    transcript?: string,
  ) {
    const qa = this.qaRepo.create({
      sessionId,
      userId, // 🆕 Added user_id
      questionNumber,
      question,
      questionCategory: category || null, // 🆕 Added category
      answer: answer || null,
      transcript: transcript || null,
    });
    return this.qaRepo.save(qa);
  }

  async updateAnswer(qaId: string, answer: string, transcript?: string) {
    await this.qaRepo.update(qaId, {
      answer,
      transcript: transcript || null,
    });
    return this.qaRepo.findOne({ where: { qaId } });
  }

  async completeSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    session.status = InterviewStatus.COMPLETED;
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  // Get all QA for a session
  async getSessionQAs(sessionId: string) {
    return this.qaRepo.find({
      where: { sessionId },
      order: { questionNumber: 'ASC' },
    });
  }

  // 🆕 Enhanced results with detailed evaluation breakdown
  async getSessionResults(sessionId: string) {
    // Get session with user info
    const session = await this.sessionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.sessionId = :sessionId', { sessionId })
      .select([
        's.sessionId',
        's.role',
        's.interviewType',
        's.status',
        's.startedAt',
        's.completedAt',
        's.createdAt',
        'u.id',
        'u.email',
      ])
      .getOne();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 🆕 Get all Q&A with detailed evaluations
    const qaList = await this.qaRepo.find({
      where: { sessionId },
      order: { questionNumber: 'ASC' },
    });

    // 🆕 Calculate comprehensive statistics
    const totalQuestions = qaList.length;
    const answeredQuestions = qaList.filter((qa) => qa.answer).length;

    const avgOverallScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.overallScore || 0), 0) / answeredQuestions
        : 0;

    const avgTechnicalScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.technicalAccuracy || 0), 0) / answeredQuestions
        : 0;

    const avgCommunicationScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.communicationClarity || 0), 0) / answeredQuestions
        : 0;

    const avgDepthScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.depthOfKnowledge || 0), 0) / answeredQuestions
        : 0;

    const avgProblemSolvingScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.problemSolvingApproach || 0), 0) / answeredQuestions
        : 0;

    const avgRoleRelevanceScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.relevanceToRole || 0), 0) / answeredQuestions
        : 0;

    // 🆕 Aggregate all strengths and improvements
    const allStrengths = qaList.flatMap((qa) => qa.strengths || []);
    const allImprovements = qaList.flatMap((qa) => qa.improvements || []);
    const allRedFlags = qaList.flatMap((qa) => qa.redFlags || []);
    const allInsights = qaList.flatMap((qa) => qa.keyInsights || []);

    // 🆕 Category performance breakdown
    const categoryPerformance: Record<string, any> = {};
    qaList.forEach((qa) => {
      if (qa.questionCategory && qa.overallScore !== null) {
        if (!categoryPerformance[qa.questionCategory]) {
          categoryPerformance[qa.questionCategory] = {
            count: 0,
            totalScore: 0,
          };
        }
        categoryPerformance[qa.questionCategory].count++;
        categoryPerformance[qa.questionCategory].totalScore += qa.overallScore;
      }
    });

    const categoryStats = Object.entries(categoryPerformance).map(([category, data]: [string, any]) => ({
      category,
      averageScore: Math.round(data.totalScore / data.count),
      questionsAsked: data.count,
    }));

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.user.id,
        userEmail: session.user.email,
        role: session.role,
        interviewType: session.interviewType,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        totalQuestions,
      },
      questions: qaList.map((qa) => ({
        questionId: qa.qaId,
        questionNumber: qa.questionNumber,
        questionCategory: qa.questionCategory,
        question: qa.question,
        answer: qa.answer,
        transcript: qa.transcript,
        
        // 🆕 Detailed scores
        scores: {
          overall: qa.overallScore,
          technical: qa.technicalAccuracy,
          communication: qa.communicationClarity,
          depth: qa.depthOfKnowledge,
          problemSolving: qa.problemSolvingApproach,
          roleRelevance: qa.relevanceToRole,
        },
        
        // 🆕 Qualitative feedback
        feedback: qa.feedback,
        strengths: qa.strengths,
        improvements: qa.improvements,
        keyInsights: qa.keyInsights,
        
        // 🆕 Metadata
        wordCount: qa.wordCount,
        answerDuration: qa.answerDurationSeconds,
        confidence: qa.confidence,
        redFlags: qa.redFlags,
        followUpQuestions: qa.followUpQuestions,
        
        answeredAt: qa.createdAt,
      })),
      
      // 🆕 Comprehensive summary
      summary: {
        overallPerformance: {
          averageScore: Math.round(avgOverallScore),
          grade: this.getGrade(avgOverallScore),
          totalAnswered: answeredQuestions,
          totalQuestions,
        },
        dimensionBreakdown: {
          technicalAccuracy: Math.round(avgTechnicalScore),
          communicationClarity: Math.round(avgCommunicationScore),
          depthOfKnowledge: Math.round(avgDepthScore),
          problemSolvingApproach: Math.round(avgProblemSolvingScore),
          relevanceToRole: Math.round(avgRoleRelevanceScore),
        },
        categoryPerformance: categoryStats,
        keyTakeaways: {
          topStrengths: this.getMostCommon(allStrengths, 5),
          areasForImprovement: this.getMostCommon(allImprovements, 5),
          criticalInsights: this.getMostCommon(allInsights, 3),
          redFlags: [...new Set(allRedFlags)],
        },
        confidenceDistribution: {
          high: qaList.filter((qa) => qa.confidence === 'high').length,
          medium: qaList.filter((qa) => qa.confidence === 'medium').length,
          low: qaList.filter((qa) => qa.confidence === 'low').length,
        },
      },
    };
  }

  // 🆕 Helper: Get grade from score
  private getGrade(score: number): string {
    if (score >= 90) return 'A (Excellent)';
    if (score >= 80) return 'B (Good)';
    if (score >= 70) return 'C (Satisfactory)';
    if (score >= 60) return 'D (Needs Improvement)';
    return 'F (Unsatisfactory)';
  }

  // 🆕 Helper: Get most common items from array
  private getMostCommon(arr: string[], limit: number): string[] {
    const frequency: Record<string, number> = {};
    arr.forEach((item) => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }
}