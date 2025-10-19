import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InterviewSession } from './interview-session.entity';

@Entity({ name: 'interview_qa' })
export class InterviewQA {
  @PrimaryGeneratedColumn('uuid', { name: 'qa_id' })
  qaId!: string;

  @Column('uuid', { name: 'session_id' })
  sessionId!: string;

  // Link each QA to its session (consider onDelete: 'CASCADE' so orphan QAs are removed when a session is deleted)
  @ManyToOne(() => InterviewSession)
  @JoinColumn({ name: 'session_id' })
  session!: InterviewSession;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  // Monotonic per-session question index (useful for ordering)
  @Column({ name: 'question_number', type: 'int' })
  questionNumber!: number;

  @Column({ name: 'question', type: 'text' })
  question!: string;

  // Optional high-level tag (e.g., technical, behavioral)
  @Column({ name: 'question_category', type: 'text', nullable: true })
  questionCategory!: string | null;

  // PostgreSQL text[] to store probed skills; default empty array
  @Column({ name: 'tested_skills', type: 'text', array: true, default: [] })
  testedSkills!: string[];

  @Column({ name: 'difficulty', type: 'varchar', length: 10, nullable: true })
  difficulty!: 'easy' | 'medium' | 'hard' | null;

  // Raw answer (free text) and/or ASR transcript
  @Column({ name: 'answer', type: 'text', nullable: true })
  answer!: string | null;

  @Column({ name: 'transcript', type: 'text', nullable: true })
  transcript!: string | null;

  @Column({ name: 'overall_score', type: 'int', nullable: true })
  overallScore!: number | null;

  @Column({ name: 'technical_accuracy', type: 'int', nullable: true })
  technicalAccuracy!: number | null;

  @Column({ name: 'communication_clarity', type: 'int', nullable: true })
  communicationClarity!: number | null;

  @Column({ name: 'depth_of_knowledge', type: 'int', nullable: true })
  depthOfKnowledge!: number | null;

  @Column({ name: 'problem_solving_approach', type: 'int', nullable: true })
  problemSolvingApproach!: number | null;

  @Column({ name: 'relevance_to_role', type: 'int', nullable: true })
  relevanceToRole!: number | null;

  // Qualitative feedback
  @Column({ name: 'feedback', type: 'text', nullable: true })
  feedback!: string | null;

  @Column({ name: 'strengths', type: 'text', array: true, nullable: true })
  strengths!: string[] | null;

  @Column({ name: 'improvements', type: 'text', array: true, nullable: true })
  improvements!: string[] | null;

  @Column({ name: 'key_insights', type: 'text', array: true, nullable: true })
  keyInsights!: string[] | null;

  // Answer metadata
  @Column({ name: 'word_count', type: 'int', nullable: true })
  wordCount!: number | null;

  @Column({ name: 'answer_duration_seconds', type: 'int', nullable: true })
  answerDurationSeconds!: number | null;

  // Confidence of LLM while scoring ('low' | 'medium' | 'high') for stronger integrity
  @Column({ name: 'confidence', type: 'varchar', length: 10, nullable: true })
  confidence!: 'low' | 'medium' | 'high' | null;

  // Flags & follow-ups for reviewer 
  @Column({ name: 'red_flags', type: 'text', array: true, nullable: true })
  redFlags!: string[] | null;

  @Column({ name: 'follow_up_questions', type: 'text', array: true, nullable: true })
  followUpQuestions!: string[] | null;

  // Legacy JSONB for backward compatibility 
  @Column({ name: 'evaluation', type: 'jsonb', nullable: true })
  evaluation!: {
    score?: number;
    feedback?: string;
    strengths?: string[];
    improvements?: string[];
  } | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
