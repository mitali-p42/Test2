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

@Entity({ name: 'interview_profiles' })
export class InterviewProfile {
  @PrimaryGeneratedColumn('uuid', { name: 'interview_id' })
  interviewId!: string;

  @Column({ name: 'skills', type: 'text', array: true, default: [] })
  skills!: string[];

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ name: 'email', type: 'text' })
  email!: string;

  @Column({ name: 'role', type: 'text', nullable: true })
  role!: string | null;

  @Column({ name: 'interview_type', type: 'text', nullable: true })
  interviewType!: string | null;

  @Column({
    name: 'years_of_experience',
    type: 'numeric',
    nullable: true,
    transformer: {
      to: (v?: number | null) => v,
      from: (v: string | null) => (v == null ? null : Number(v)),
    },
  })
  yearsOfExperience!: number | null;

  @Column({ 
    name: 'total_questions', 
    type: 'int', 
    default: 5,
    nullable: true 
  })
  totalQuestions!: number;

  // 🆕 Company Name
  @Column({ name: 'company_name', type: 'text', nullable: true })
  companyName!: string | null;

  // 🆕 Recruiter who created this profile
  @Column('uuid', { name: 'recruiter_id', nullable: true })
  recruiterId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recruiter_id' })
  recruiter!: User | null;

  // 🆕 Flag to indicate if created by recruiter
  @Column({ name: 'created_by_recruiter', type: 'boolean', default: false })
  createdByRecruiter!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}