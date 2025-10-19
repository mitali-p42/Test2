// backend/src/interview/interview.service.ts (UPDATED)
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewSession, InterviewStatus } from './interview-session.entity';
import { InterviewQA } from './interview-qa.entity';
import { AIService, DetailedEvaluation, QuestionHint } from './ai.service';

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

  // 🆕 Generate next question with difficulty tracking
  // async generateNextQuestion(
  //   sessionId: string,
  //   yearsOfExperience: number | string = 0,
  // ): Promise<{ 
  //   question: string; 
  //   questionNumber: number; 
  //   audioBuffer: Buffer; 
  //   category: string;
  //   difficulty: 'easy' | 'medium' | 'hard';
  // }> {
  //   const session = await this.getSession(sessionId);
  //   const nextNumber = session.currentQuestionIndex + 1;

  //   if (nextNumber > session.totalQuestions) {
  //     throw new Error('Interview completed');
  //   }

  //   // 🆕 Get previously asked questions to determine difficulty distribution
  //   const previousQAs = await this.qaRepo.find({
  //     where: { sessionId },
  //     order: { questionNumber: 'ASC' },
  //     select: ['difficulty', 'questionNumber'],
  //   });

  //   const previousDifficulties = previousQAs
  //     .map(qa => qa.difficulty)
  //     .filter((d): d is 'easy' | 'medium' | 'hard' => d !== null);

  //   console.log(`📝 Generating Q${nextNumber} - Previous difficulties:`, previousDifficulties);

  //   // 🆕 Generate question with intelligent difficulty selection
  //   const { question, difficulty, category } = await this.aiService.generateQuestion(
  //     session.role,
  //     session.interviewType,
  //     yearsOfExperience,
  //     nextNumber,
  //     previousDifficulties,
  //   );

  //   console.log(`✅ Generated ${difficulty} question in category ${category}`);

  //   // 🆕 Save question with difficulty
  //   await this.saveQA(sessionId, session.userId, nextNumber, question, category, difficulty);

  //   // Generate audio for question
  //   const audioBuffer = await this.aiService.textToSpeech(question);

  //   // Update current question index
  //   session.currentQuestionIndex = nextNumber;
  //   await this.sessionRepo.save(session);

  //   return { question, questionNumber: nextNumber, audioBuffer, category, difficulty };
  // }
  // async generateNextQuestion(
  //   sessionId: string,
  //   yearsOfExperience: number | string = 0,
  // ): Promise<{ question: string; questionNumber: number; audioBuffer: Buffer; category: string; difficulty: string }> {
  //   const session = await this.getSession(sessionId);
  //   const nextNumber = session.currentQuestionIndex + 1;

  //   if (nextNumber > session.totalQuestions) {
  //     throw new Error('Interview completed');
  //   }

    

  //   // 🆕 Determine question category
  //   const categories = ['behavioral', 'technical', 'situational', 'competency', 'problemSolving'];
  //   const category = categories[(nextNumber - 1) % categories.length];

  //   console.log(`📝 Generating question ${nextNumber} - Category: ${category}`);

  //   // Generate diverse question using AI with difficulty
  //   const { question, difficulty } = await this.aiService.generateQuestion(
  //     session.role,
  //     session.interviewType,
  //     yearsOfExperience,
  //     nextNumber,
  //   );

  //   console.log(`🎚️ Question difficulty: ${difficulty}`);

  //   // Save question to DB with category and difficulty
  //   await this.saveQA(sessionId, session.userId, nextNumber, question, category, difficulty);

  //   // Generate audio for question
  //   const audioBuffer = await this.aiService.textToSpeech(question);

  //   // Update current question index
  //   session.currentQuestionIndex = nextNumber;
  //   await this.sessionRepo.save(session);

  //   return { question, questionNumber: nextNumber, audioBuffer, category, difficulty };
  // }

  // 🆕 Generate next question with category tracking
  // async generateNextQuestion(
  //   sessionId: string,
  //   yearsOfExperience: number | string = 0,
  // ): Promise<{ question: string; questionNumber: number; audioBuffer: Buffer; category: string; difficulty: string }> {
  //   const session = await this.getSession(sessionId);
  //   const nextNumber = session.currentQuestionIndex + 1;

  //   if (nextNumber > session.totalQuestions) {
  //     throw new Error('Interview completed');
  //   }

    

  //   // 🆕 Determine question category
  //   const categories = ['behavioral', 'technical', 'situational', 'competency', 'problemSolving'];
  //   const category = categories[(nextNumber - 1) % categories.length];

  //   console.log(`📝 Generating question ${nextNumber} - Category: ${category}`);

  //   // Generate diverse question using AI with difficulty
  //   const { question, difficulty } = await this.aiService.generateQuestion(
  //     session.role,
  //     session.interviewType,
  //     yearsOfExperience,
  //     nextNumber,
  //   );

  //   console.log(`🎚️ Question difficulty: ${difficulty}`);

  //   // Save question to DB with category and difficulty
  //   await this.saveQA(sessionId, session.userId, nextNumber, question, category, difficulty);

  //   // Generate audio for question
  //   const audioBuffer = await this.aiService.textToSpeech(question);

  //   // Update current question index
  //   session.currentQuestionIndex = nextNumber;
  //   await this.sessionRepo.save(session);

  //   return { question, questionNumber: nextNumber, audioBuffer, category, difficulty };
  // }
  async generateNextQuestion(
    sessionId: string,
    yearsOfExperience: number | string = 0,
  ): Promise<{ question: string; questionNumber: number; audioBuffer: Buffer; category: string; difficulty: string }> {
    const session = await this.getSession(sessionId);
    const nextNumber = session.currentQuestionIndex + 1;

    if (nextNumber > session.totalQuestions) {
      throw new Error('Interview completed');
    }

    // Determine question category
    const categories = ['behavioral', 'technical', 'situational', 'competency', 'problemSolving'];
    const category = categories[(nextNumber - 1) % categories.length];

    console.log(`📝 Generating question ${nextNumber} - Category: ${category}`);

    // Generate diverse question using AI with difficulty
    const { question, difficulty } = await this.aiService.generateQuestion(
      session.role,
      session.interviewType,
      yearsOfExperience,
      nextNumber,
    );

    console.log(`🎚️ Question difficulty: ${difficulty}`);

    // Save question to DB with category and difficulty
    await this.saveQA(sessionId, session.userId, nextNumber, question, category, difficulty);

    // Generate audio for question
    const audioBuffer = await this.aiService.textToSpeech(question);

    // Update current question index
    session.currentQuestionIndex = nextNumber;
    await this.sessionRepo.save(session);

    return { question, questionNumber: nextNumber, audioBuffer, category, difficulty };
  }
  // 🆕 Get hint - only allowed for HARD questions
  // async getQuestionHint(sessionId: string, questionNumber: number): Promise<QuestionHint> {
  //   console.log('💡 Hint request for question:', { sessionId, questionNumber });

  //   // Get the question
  //   const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
  //   if (!qa) {
  //     throw new NotFoundException(`Question ${questionNumber} not found`);
  //   }

  //   // 🚨 CRITICAL: Check difficulty - only HARD questions get hints
  //   if (!qa.difficulty || qa.difficulty !== 'hard') {
  //     throw new BadRequestException(
  //       `Hints are only available for hard difficulty questions. This question is ${qa.difficulty || 'unrated'}.`
  //     );
  //   }

  //   console.log(`✅ Question ${questionNumber} is HARD - generating hint`);

  //   // Get session for role/type context
  //   const session = await this.getSession(sessionId);

  //   // Generate hint using AI
  //   const hint = await this.aiService.generateQuestionHint(
  //     qa.question,
  //     session.role,
  //     session.interviewType,
  //     qa.difficulty, // TypeScript knows this is 'hard' due to the check above
  //   );

  //   console.log('✅ Hint generated for hard question');
  //   return hint;
  // }
  async getQuestionHint(sessionId: string, questionNumber: number): Promise<QuestionHint> {
    console.log('💡 Generating hint for question:', { sessionId, questionNumber });

    // Get the question
    const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
    if (!qa) {
      throw new NotFoundException(`Question ${questionNumber} not found`);
    }
    
    if (!qa.difficulty || qa.difficulty !== 'hard') {
    throw new BadRequestException(
      `Hints are only available for hard difficulty questions. This question is ${qa.difficulty || 'unrated'}.`
    );
  }
  console.log(`✅ Question ${questionNumber} is HARD - generating hint`);

    // Get session for role/type context
    const session = await this.getSession(sessionId);

    // Generate hint using AI with optional difficulty context
    const hint = await this.aiService.generateQuestionHint(
    qa.question,
    session.role,
    session.interviewType,
  );

    console.log('✅ Hint generated for hard question');
    return hint;
  }

  async processAnswer(
    sessionId: string,
    questionNumber: number,
    audioBuffer: Buffer,
    yearsOfExperience: number | string = 0,
  ): Promise<{ transcript: string; evaluation: DetailedEvaluation }> {
    console.log('🔍 Processing answer:', { sessionId, questionNumber });

    const startTime = Date.now();
    const transcript = await this.aiService.transcribeAudio(
      audioBuffer,
      `answer-${Date.now()}.webm`,
    );
    const answerDuration = Math.round((Date.now() - startTime) / 1000);

    const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
    if (!qa) {
      throw new NotFoundException(`Question ${questionNumber} not found`);
    }

    const session = await this.getSession(sessionId);

    console.log('🤖 Starting evaluation...');

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
    });

    // Update QA record
    qa.answer = transcript;
    qa.transcript = transcript;
    qa.overallScore = evaluation.overallScore;
    qa.technicalAccuracy = evaluation.technicalAccuracy;
    qa.communicationClarity = evaluation.communicationClarity;
    qa.depthOfKnowledge = evaluation.depthOfKnowledge;
    qa.problemSolvingApproach = evaluation.problemSolvingApproach;
    qa.relevanceToRole = evaluation.relevanceToRole;
    qa.feedback = evaluation.feedback;
    qa.strengths = evaluation.strengths;
    qa.improvements = evaluation.improvements;
    qa.keyInsights = evaluation.keyInsights;
    qa.wordCount = evaluation.wordCount;
    qa.answerDurationSeconds = answerDuration;
    qa.confidence = evaluation.confidence;
    qa.redFlags = evaluation.redFlags;
    qa.followUpQuestions = evaluation.followUpQuestions;
    qa.evaluation = {
      score: evaluation.overallScore,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
    };

    await this.qaRepo.save(qa);

    return { transcript, evaluation };
  }

  // 🆕 Updated saveQA with difficulty parameter
  // async saveQA(
  //   sessionId: string,
  //   userId: string,
  //   questionNumber: number,
  //   question: string,
  //   category?: string,
  //   difficulty?: 'easy' | 'medium' | 'hard',
  //   answer?: string,
  //   transcript?: string,
  // ) {
  //   const qa = this.qaRepo.create({
  //     sessionId,
  //     userId,
  //     questionNumber,
  //     question,
  //     questionCategory: category || null,
  //     difficulty: difficulty || null, // 🆕 Save difficulty
  //     answer: answer || null,
  //     transcript: transcript || null,
  //   });
  //   return this.qaRepo.save(qa);
  // }
  async saveQA(
    sessionId: string,
    userId: string,
    questionNumber: number,
    question: string,
    category?: string,
    difficulty?: 'easy' | 'medium' | 'hard',
    answer?: string,
    transcript?: string,
  ) {
    const qa = this.qaRepo.create({
      sessionId,
      userId,
      questionNumber,
      question,
      questionCategory: category || null,
      difficulty: difficulty || null, // 🆕 Added difficulty
      answer: answer || null,
      transcript: transcript || null,
    });
    return this.qaRepo.save(qa);
  }
  async completeSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    session.status = InterviewStatus.COMPLETED;
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  async getSessionQAs(sessionId: string) {
    return this.qaRepo.find({
      where: { sessionId },
      order: { questionNumber: 'ASC' },
    });
  }

  // 🆕 Enhanced results with difficulty breakdown
  async getSessionResults(sessionId: string) {
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

    const qaList = await this.qaRepo.find({
      where: { sessionId },
      order: { questionNumber: 'ASC' },
    });

    const totalQuestions = qaList.length;
    const answeredQuestions = qaList.filter((qa) => qa.answer).length;

    const avgOverallScore =
      answeredQuestions > 0
        ? qaList.reduce((sum, qa) => sum + (qa.overallScore || 0), 0) / answeredQuestions
        : 0;

    // 🆕 Difficulty performance breakdown
    // const difficultyPerformance: Record<string, any> = {};
    // qaList.forEach((qa) => {
    //   if (qa.difficulty && qa.overallScore !== null) {
    //     if (!difficultyPerformance[qa.difficulty]) {
    //       difficultyPerformance[qa.difficulty] = {
    //         count: 0,
    //         totalScore: 0,
    //       };
    //     }
    //     difficultyPerformance[qa.difficulty].count++;
    //     difficultyPerformance[qa.difficulty].totalScore += qa.overallScore;
    //   }
    // });

    // const difficultyStats = Object.entries(difficultyPerformance).map(([difficulty, data]: [string, any]) => ({
    //   difficulty,
    //   averageScore: Math.round(data.totalScore / data.count),
    //   questionsAsked: data.count,
    // }));
    const difficultyPerformance: Record<string, any> = {};
    qaList.forEach((qa) => {
      if (qa.difficulty && qa.overallScore !== null) {
        if (!difficultyPerformance[qa.difficulty]) {
          difficultyPerformance[qa.difficulty] = {
            count: 0,
            totalScore: 0,
          };
        }
        difficultyPerformance[qa.difficulty].count++;
        difficultyPerformance[qa.difficulty].totalScore += qa.overallScore;
      }
    });

    const difficultyStats = Object.entries(difficultyPerformance).map(([difficulty, data]: [string, any]) => ({
      difficulty,
      averageScore: Math.round(data.totalScore / data.count),
      questionsAsked: data.count,
    }));

    console.log('📊 Difficulty distribution:', difficultyStats);

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.user.id,
        userEmail: session.user.email,
        role: session.role,
        interviewType: session.interviewType,
        status: session.status,
        totalQuestions,
      },
      questions: qaList.map((qa) => ({
        questionId: qa.qaId,
        questionNumber: qa.questionNumber,
        questionCategory: qa.questionCategory,
        difficulty: qa.difficulty, // 🆕 Add this line
        question: qa.question,
        answer: qa.answer,
        transcript: qa.transcript,
        scores: {
          overall: qa.overallScore,
          technical: qa.technicalAccuracy,
          communication: qa.communicationClarity,
          depth: qa.depthOfKnowledge,
          problemSolving: qa.problemSolvingApproach,
          roleRelevance: qa.relevanceToRole,
        },
        feedback: qa.feedback,
        strengths: qa.strengths,
        improvements: qa.improvements,
        keyInsights: qa.keyInsights,
        wordCount: qa.wordCount,
        answerDuration: qa.answerDurationSeconds,
        confidence: qa.confidence,
        redFlags: qa.redFlags,
        followUpQuestions: qa.followUpQuestions,
        answeredAt: qa.createdAt,
      })),
      summary: {
        overallPerformance: {
          averageScore: Math.round(avgOverallScore),
          grade: this.getGrade(avgOverallScore),
          totalAnswered: answeredQuestions,
          totalQuestions,
        },
        difficultyBreakdown: difficultyStats, // 🆕 Difficulty performance
      },
    };
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A (Excellent)';
    if (score >= 80) return 'B (Good)';
    if (score >= 70) return 'C (Satisfactory)';
    if (score >= 60) return 'D (Needs Improvement)';
    return 'F (Unsatisfactory)';
  }

  async textToSpeech(text: string): Promise<Buffer> {
    return this.aiService.textToSpeech(text);
  }
}