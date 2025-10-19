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

  // Create a new session with validated total question count
  async createSession(
    userId: string,
    role: string,
    interviewType: string,
    yearsOfExperience?: number,
    skills?: string[],
    totalQuestions: number = 5,
  ) {
    const validatedTotal = Math.min(Math.max(totalQuestions, 1), 20);

    const session = this.sessionRepo.create({
      userId,
      role,
      interviewType,
      skills: skills || [],
      status: InterviewStatus.PENDING,
      totalQuestions: validatedTotal,
      currentQuestionIndex: 0,
    });

    return this.sessionRepo.save(session);
  }

  // Mark session as in progress and set start time
  async startSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    session.status = InterviewStatus.IN_PROGRESS;
    session.startedAt = new Date();
    return this.sessionRepo.save(session);
  }

  // Retrieve a session by id or throw if not found
  async getSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  // Increment tab switch counters and optionally terminate session
  async recordTabSwitch(sessionId: string): Promise<{
    tabSwitches: number;
    shouldTerminate: boolean;
  }> {
    const session = await this.sessionRepo.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    // Ignore if already finished
    if (
      session.status === InterviewStatus.COMPLETED ||
      session.status === InterviewStatus.CANCELLED
    ) {
      return { tabSwitches: session.tabSwitches, shouldTerminate: false };
    }

    session.tabSwitches += 1;
    session.tabSwitchTimestamps = [...session.tabSwitchTimestamps, new Date()];

    const shouldTerminate = session.tabSwitches >= 3;
    if (shouldTerminate) {
      session.status = InterviewStatus.CANCELLED;
      session.terminatedForTabSwitches = true;
      session.completedAt = new Date();
    }

    await this.sessionRepo.save(session);
    return { tabSwitches: session.tabSwitches, shouldTerminate };
  }

  /** -------------------- STT (chunk) -------------------- */

  // Transcribe a short audio chunk; returns plain text or empty string on failure
  async transcribeAudioChunk(
    audioBuffer: Buffer,
    previousContext: string = '',
  ): Promise<string> {
    try {
      const chunkResult = await this.aiService.transcribeAudioChunk(
        audioBuffer,
        `chunk-${Date.now()}.webm`,
        previousContext,
      );

      const text = chunkResult?.text ?? '';
      return text;
    } catch (err: any) {
      console.error('❌ Chunk transcription failed:', err);
      return '';
    }
  }

  /** -------------------- Questions -------------------- */

  // Generate the next question, persist its QA record, and synthesize TTS audio
  async generateNextQuestion(
    sessionId: string,
    yearsOfExperience: number | string = 0,
  ): Promise<{
    question: string;
    questionNumber: number;
    audioBuffer: Buffer;
    category: string;
    difficulty: string;
    testedSkills: string[];
  }> {
    const session = await this.getSession(sessionId);
    const nextNumber = session.currentQuestionIndex + 1;

    if (nextNumber > session.totalQuestions) {
      throw new Error('Interview completed');
    }

    // Round-robin category assignment
    const categories = ['behavioral', 'technical', 'situational', 'competency', 'problemSolving'];
    const category = categories[(nextNumber - 1) % categories.length];

    // Generate question via AI and store initial QA row
    const { question, difficulty, testedSkills } = await this.aiService.generateQuestion(
      session.role,
      session.interviewType,
      yearsOfExperience,
      nextNumber,
      session.skills,
    );

    await this.saveQA(
      sessionId,
      session.userId,
      nextNumber,
      question,
      category,
      difficulty as any,
      undefined,
      undefined,
      testedSkills || [],
    );

    // Generate TTS audio for the question
    const audioBuffer = await this.aiService.textToSpeech(question);

    // Advance session progress
    session.currentQuestionIndex = nextNumber;
    await this.sessionRepo.save(session);

    return {
      question,
      questionNumber: nextNumber,
      audioBuffer,
      category,
      difficulty,
      testedSkills: testedSkills || [],
    };
  }

  /** -------------------- Hints (only for hard) -------------------- */

  // Return a hint for a stored question; allowed only when difficulty is 'hard'
  async getQuestionHint(sessionId: string, questionNumber: number): Promise<QuestionHint> {
    const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
    if (!qa) throw new NotFoundException(`Question ${questionNumber} not found`);

    if (!qa.difficulty || qa.difficulty !== 'hard') {
      throw new BadRequestException(
        `Hints are only available for hard difficulty questions. This question is ${qa.difficulty || 'unrated'}.`,
      );
    }

    const session = await this.getSession(sessionId);
    return this.aiService.generateQuestionHint(qa.question, session.role, session.interviewType);
  }

  /** -------------------- Answer Processing -------------------- */

  // Transcribe the submitted audio and run multi-metric evaluation; persist results on QA
  async processAnswer(
    sessionId: string,
    questionNumber: number,
    audioBuffer: Buffer,
    yearsOfExperience: number | string = 0,
  ): Promise<{ transcript: string; evaluation: DetailedEvaluation }> {
    const startTime = Date.now();

    const transcript: string = await this.aiService.transcribeAudio(
      audioBuffer,
      `answer-${Date.now()}.webm`,
    );

    const answerDuration = Math.round((Date.now() - startTime) / 1000);

    const qa = await this.qaRepo.findOne({ where: { sessionId, questionNumber } });
    if (!qa) throw new NotFoundException(`Question ${questionNumber} not found`);

    const session = await this.getSession(sessionId);

    const evaluation = await this.aiService.evaluateAnswer(
      qa.question,
      transcript,
      session.role,
      yearsOfExperience,
      questionNumber,
    );

    // Persist evaluation details on QA row
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

  /** -------------------- Persistence helpers -------------------- */

  // Create and save a QA row for a question
  async saveQA(
    sessionId: string,
    userId: string,
    questionNumber: number,
    question: string,
    category?: string,
    difficulty?: 'easy' | 'medium' | 'hard',
    answer?: string,
    transcript?: string,
    testedSkills?: string[],
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
      testedSkills: testedSkills || [],
    });
    return this.qaRepo.save(qa);
  }

  // Mark a session as completed and set completion time
  async completeSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    session.status = InterviewStatus.COMPLETED;
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  // Return all QA rows for a session ordered by question number
  async getSessionQAs(sessionId: string) {
    return this.qaRepo.find({
      where: { sessionId },
      order: { questionNumber: 'ASC' },
    });
  }

  /** -------------------- Results / Summary -------------------- */

  // Aggregate session with user info and computed performance statistics
  async getSessionResults(sessionId: string) {
    const session = await this.sessionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.sessionId = :sessionId', { sessionId })
      .select([
        's.sessionId',
        's.role',
        's.interviewType',
        's.totalQuestions',
        's.status',
        's.startedAt',
        's.skills',
        's.terminatedForTabSwitches',
        's.completedAt',
        's.createdAt',
        'u.id',
        'u.email',
      ])
      .getOne();

    if (!session) throw new NotFoundException('Session not found');

    const qaList = await this.qaRepo.find({
      where: { sessionId },
      order: { questionNumber: 'ASC' },
    });

    const totalQuestions = session.totalQuestions || 5;
    const answeredQuestions = qaList.filter((qa) => qa.answer).length;

    // Overall average across all questions (includes unanswered as 0)
    const sumOfScores = qaList.reduce((sum, qa) => sum + (qa.overallScore || 0), 0);
    const avgOverallScore = totalQuestions > 0 ? Math.round(sumOfScores / totalQuestions) : 0;

    // Average per difficulty band
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

    // Skill performance aggregation across QAs
    const skillPerformance: Record<string, { count: number; totalScore: number; questions: number[] }> =
      {};

    qaList.forEach((qa) => {
      if (qa.testedSkills && qa.testedSkills.length > 0 && qa.overallScore !== null) {
        qa.testedSkills.forEach((skill) => {
          if (!skillPerformance[skill]) {
            skillPerformance[skill] = { count: 0, totalScore: 0, questions: [] };
          }
          skillPerformance[skill].count++;
          skillPerformance[skill].totalScore += qa.overallScore!;
          skillPerformance[skill].questions.push(qa.questionNumber);
        });
      }
    });

    const skillStats = Object.entries(skillPerformance)
      .map(([skill, data]) => ({
        skill,
        averageScore: Math.round(data.totalScore / data.count),
        timesTested: data.count,
        questionNumbers: data.questions,
        performance:
          data.totalScore / data.count >= 85
            ? 'excellent'
            : data.totalScore / data.count >= 70
            ? 'good'
            : data.totalScore / data.count >= 55
            ? 'satisfactory'
            : 'needs improvement',
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    // Report skills not covered by any QA
    const allSkills = session.skills || [];
    const testedSkills = new Set(Object.keys(skillPerformance));
    const untestedSkills = allSkills.filter((skill) => !testedSkills.has(skill));

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.user.id,
        userEmail: session.user.email,
        role: session.role,
        interviewType: session.interviewType,
        status: session.status,
        totalQuestions,
        allSkills,
      },
      questions: qaList.map((qa) => ({
        questionId: qa.qaId,
        questionNumber: qa.questionNumber,
        questionCategory: qa.questionCategory,
        difficulty: qa.difficulty,
        question: qa.question,
        testedSkills: qa.testedSkills || [],
        totalQuestions,
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
        skillPerformance: skillStats,
        difficultyBreakdown: difficultyStats,
        untestedSkills,
      },
    };
  }

  // Map numeric score to a descriptive grade label
  private getGrade(score: number): string {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Satisfactory';
    return 'Needs Improvement';
  }

  // Thin wrapper to AI TTS for controller usage
  async textToSpeech(text: string): Promise<Buffer> {
    return this.aiService.textToSpeech(text);
  }
}