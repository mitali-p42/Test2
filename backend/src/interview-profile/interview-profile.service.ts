import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewProfile } from './interview-profile.entity';

@Injectable()
export class InterviewProfileService {
  constructor(
    @InjectRepository(InterviewProfile)
    private readonly repo: Repository<InterviewProfile>,
  ) {}

  async getProfileForUser(userId: string) {
    return await this.repo.findOne({ where: { userId } });
  }

  async upsertProfile(
    userId: string,
    email: string,
    data: {
      role?: string;
      interviewType?: string;
      yearsOfExperience?: number;
      skills?: string[];
      totalQuestions?: number; 
    }
  ) {
    const existing = await this.repo.findOne({ where: { userId } });

    if (existing) {
      // Update existing profile
      await this.repo.update(
        { userId },
        {
          role: data.role,
          interviewType: data.interviewType,
          yearsOfExperience: data.yearsOfExperience,
          skills: data.skills,
          totalQuestions: data.totalQuestions ?? existing.totalQuestions, // 🆕 Update if provided
        }
      );
      return this.repo.findOne({ where: { userId } });
    } else {
      // Create new profile
      const profile = this.repo.create({
        userId,
        email,
        role: data.role,
        interviewType: data.interviewType,
        yearsOfExperience: data.yearsOfExperience,
        skills: data.skills || [],
        totalQuestions: data.totalQuestions ?? 5, // Default to 5
      });
      return this.repo.save(profile);
    }
  }
}