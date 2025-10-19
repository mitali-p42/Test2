// backend/src/interview/interview.service.ts
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

  /** -------------------- Sessions -------------------- */

  async createSession(
    userId: string,
    role: string,
    interviewType: string,
    yearsOfExperience?: number,
    skills?: string[], 
  ) {
    const session = this.sessionRepo.create({
      userId,
      role,
      interviewType,
      skills: skills || [],
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
  

   async recordTabSwitch(sessionId: string): Promise<{
    tabSwitches: number;
    shouldTerminate: boolean;
  }> {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === InterviewStatus.COMPLETED || session.status === InterviewStatus.CANCELLED) {
      console.log('⚠️ Tab switch recorded for already completed/cancelled session');
      return { tabSwitches: session.tabSwitches, shouldTerminate: false };
    }

    // Increment tab switches
    session.tabSwitches += 1;
    session.tabSwitchTimestamps = [...session.tabSwitchTimestamps, new Date()];

    const shouldTerminate = session.tabSwitches >= 3;

    if (shouldTerminate) {
      console.log('🛑 Terminating interview due to tab switches:', {
        sessionId,
        count: session.tabSwitches,
      });

      session.status = InterviewStatus.CANCELLED;
      session.terminatedForTabSwitches = true;
      session.completedAt = new Date();
    }

    await this.sessionRepo.save(session);

    console.log('📊 Tab switch recorded:', {
      sessionId,
      count: session.tabSwitches,
      shouldTerminate,
    });

    return {
      tabSwitches: session.tabSwitches,
      shouldTerminate,
    };
  }




  /** -------------------- STT (chunk) -------------------- */
  // NOTE: aiService.transcribeAudioChunk returns { text, confidence? }
  // We log details and return text (string) to keep the signature simple for callers.
  // async transcribeAudioChunk(
  //   audioBuffer: Buffer,
  //   previousContext: string = '',
  // ): Promise<string> {
  //   try {
  //     console.log('🎙️ Transcribing audio chunk:', {
  //       size: audioBuffer.length,
  //       contextLength: previousContext.length,
  //     });

  //     const chunkResult = await this.aiService.transcribeAudioChunk(
  //       audioBuffer,
  //       `chunk-${Date.now()}.webm`,
  //       previousContext,
  //     ); // => { text, confidence? }

  //     const text = chunkResult?.text ?? '';
  //     const confidence = chunkResult?.confidence;

  //     console.log('✅ Chunk transcribed:', {
  //       length: text.length,
  //       preview: text.substring(0, 50),
  //       confidence,
  //     });

  //     return text;
  //   } catch (err: any) {
  //     console.error('❌ Chunk transcription failed:', err);
  //     return '';
  //   }
  // }
async transcribeAudioChunk(
  audioBuffer: Buffer,
  previousContext: string = '',
): Promise<string> {
  try {
    console.log('🎙️ Transcribing audio chunk:', {
      size: audioBuffer.length,
      contextLength: previousContext.length,
    });

    const chunkResult = await this.aiService.transcribeAudioChunk(
      audioBuffer,
      `chunk-${Date.now()}.webm`,
      previousContext,
    ); // => { text, confidence? }

    const text = chunkResult?.text ?? '';
    const confidence = chunkResult?.confidence;

    console.log('✅ Chunk transcribed:', {
      length: text.length,  // ✅ Fixed: use text.length
      preview: text.substring(0, 50),  // ✅ Fixed: use text.substring
      confidence,
    });

    return text;  // ✅ Fixed: return text (string), not the full object
  } catch (err: any) {
    console.error('❌ Chunk transcription failed:', err);
    return '';
  }
}
  /** -------------------- Questions -------------------- */
  async generateNextQuestion(
    sessionId: string,
    yearsOfExperience: number | string = 0,
  ): Promise<{
    question: string;
    questionNumber: number;
    audioBuffer: Buffer;
    category: string;
    difficulty: string;
  }> {
    const session = await this.getSession(sessionId);
    const nextNumber = session.currentQuestionIndex + 1;

    if (nextNumber > session.totalQuestions) {
      throw new Error('Interview completed');
    }

    // Rotate simple categories for variety
    const categories = ['behavioral', 'technical', 'situational', 'competency', 'problemSolving'];
    const category = categories[(nextNumber - 1) % categories.length];

    console.log(`📝 Generating question ${nextNumber} - Category: ${category}`);

    const { question, difficulty } = await this.aiService.generateQuestion(
      session.role,
      session.interviewType,
      yearsOfExperience,
      nextNumber,
    );

    console.log(`🎚️ Question difficulty: ${difficulty}`);

    await this.saveQA(sessionId, session.userId, nextNumber, question, category, difficulty as any);

    const audioBuffer = await this.aiService.textToSpeech(question);

    session.currentQuestionIndex = nextNumber;
    await this.sessionRepo.save(session);

    return { question, questionNumber: nextNumber, audioBuffer, category, difficulty };
  }

  /** -------------------- Hints (only for hard) -------------------- */
  async getQuestionHint(sessionId: string, questionNumber: number): Promise<QuestionHint> {
    console.log('💡 Generating hint for question:', { sessionId, questionNumber });

    const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
    if (!qa) {
      throw new NotFoundException(`Question ${questionNumber} not found`);
    }

    if (!qa.difficulty || qa.difficulty !== 'hard') {
      throw new BadRequestException(
        `Hints are only available for hard difficulty questions. This question is ${qa.difficulty || 'unrated'}.`,
      );
    }
    console.log(`✅ Question ${questionNumber} is HARD - generating hint`);

    const session = await this.getSession(sessionId);

    const hint = await this.aiService.generateQuestionHint(
      qa.question,
      session.role,
      session.interviewType,
    );

    console.log('✅ Hint generated for hard question');
    return hint;
  }

  /** -------------------- Answer Processing -------------------- */
  // NOTE: aiService.transcribeAudio returns string in your implementation.
  async processAnswer(
    sessionId: string,
    questionNumber: number,
    audioBuffer: Buffer,
    yearsOfExperience: number | string = 0,
  ): Promise<{ transcript: string; evaluation: DetailedEvaluation }> {
    console.log('🔍 Processing answer:', { sessionId, questionNumber });

    const startTime = Date.now();

    const transcript: string = await this.aiService.transcribeAudio(
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

    // Persist evaluation details
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
    qa.confidence = evaluation.confidence; // keep eval confidence; STT confidence lives in chunk path
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

  /** -------------------- Persistence helpers -------------------- */
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
      difficulty: difficulty || null,
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

  /** -------------------- Results / Summary -------------------- */
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

    // Aggregate by difficulty
    const difficultyPerformance: Record<
      'easy' | 'medium' | 'hard' | string,
      { count: number; totalScore: number }
    > = {};
    qaList.forEach((qa) => {
      if (qa.difficulty && qa.overallScore !== null && qa.overallScore !== undefined) {
        if (!difficultyPerformance[qa.difficulty]) {
          difficultyPerformance[qa.difficulty] = { count: 0, totalScore: 0 };
        }
        difficultyPerformance[qa.difficulty].count++;
        difficultyPerformance[qa.difficulty].totalScore += qa.overallScore;
      }
    });

    const difficultyStats = Object.entries(difficultyPerformance).map(([difficulty, data]) => ({
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
        difficulty: qa.difficulty,
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
        difficultyBreakdown: difficultyStats,
      },
    };
  }

  /** -------------------- Utilities -------------------- */
  private getGrade(score: number): string {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Satisfactory';
    return 'Needs Improvement';
  }

  async textToSpeech(text: string): Promise<Buffer> {
    return this.aiService.textToSpeech(text);
  }
}
