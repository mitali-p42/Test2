// backend/src/interview/interview-session.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum InterviewStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'interview_sessions' })
export class InterviewSession {
  @PrimaryGeneratedColumn('uuid', { name: 'session_id' })
  sessionId!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'role', type: 'text' })
  role!: string;

  @Column({ name: 'interview_type', type: 'text' })
  interviewType!: string;

  @Column({ name: 'status', type: 'varchar', default: InterviewStatus.PENDING })
  status!: InterviewStatus;

  @Column({ name: 'current_question_index', type: 'int', default: 0 })
  currentQuestionIndex!: number;

  @Column({ name: 'total_questions', type: 'int', default: 5 })
  totalQuestions!: number;

  // 🆕 Tab switch tracking
  @Column({ name: 'tab_switches', type: 'int', default: 0 })
  tabSwitches!: number;

  @Column({ name: 'tab_switch_timestamps', type: 'timestamptz', array: true, default: [] })
  tabSwitchTimestamps!: Date[];

  @Column({ name: 'terminated_for_tab_switches', type: 'boolean', default: false })
  terminatedForTabSwitches!: boolean;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}