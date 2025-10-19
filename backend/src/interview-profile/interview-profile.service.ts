import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewProfile } from './interview-profile.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class InterviewProfileService {
  constructor(
    @InjectRepository(InterviewProfile)
    private readonly repo: Repository<InterviewProfile>,
    private readonly usersService: UsersService,
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
      companyName?: string;
      recruiterId?: string;
      createdByRecruiter?: boolean;
    }
  ) {
    const existing = await this.repo.findOne({ where: { userId } });

    if (existing) {
      await this.repo.update(
        { userId },
        {
          role: data.role,
          interviewType: data.interviewType,
          yearsOfExperience: data.yearsOfExperience,
          skills: data.skills,
          totalQuestions: data.totalQuestions ?? existing.totalQuestions,
          companyName: data.companyName ?? existing.companyName,
        }
      );
      return this.repo.findOne({ where: { userId } });
    } else {
      const profile = this.repo.create({
        userId,
        email,
        role: data.role,
        interviewType: data.interviewType,
        yearsOfExperience: data.yearsOfExperience,
        skills: data.skills || [],
        totalQuestions: data.totalQuestions ?? 5,
        companyName: data.companyName,
        recruiterId: data.recruiterId,
        createdByRecruiter: data.createdByRecruiter ?? false,
      });
      return this.repo.save(profile);
    }
  }

  // 🆕 Create profile for candidate by recruiter
  async createCandidateProfile(
    candidateEmail: string,
    recruiterId: string,
    data: {
      role: string;
      interviewType: string;
      yearsOfExperience?: number;
      skills: string[];
      totalQuestions?: number;
      companyName: string;
    }
  ) {
    // Check if candidate already exists
    let candidate = await this.usersService.findByEmail(candidateEmail);
    
    if (candidate) {
      // Check if profile already exists
      const existingProfile = await this.repo.findOne({ 
        where: { userId: candidate.id } 
      });
      
      if (existingProfile) {
        throw new ConflictException('Profile already exists for this candidate');
      }
    } else {
      // Create candidate user account with a temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      
      candidate = await this.usersService.create(
        candidateEmail,
        passwordHash,
        'candidate'
      );
    }

    // Create interview profile
    const profile = this.repo.create({
      userId: candidate.id,
      email: candidateEmail,
      role: data.role,
      interviewType: data.interviewType,
      yearsOfExperience: data.yearsOfExperience,
      skills: data.skills,
      totalQuestions: data.totalQuestions ?? 5,
      companyName: data.companyName,
      recruiterId: recruiterId,
      createdByRecruiter: true,
    });

    return this.repo.save(profile);
  }

  // 🆕 Get all profiles created by a recruiter
  async getProfilesByRecruiter(recruiterId: string) {
    return this.repo.find({
      where: { recruiterId },
      order: { createdAt: 'DESC' },
    });
  }
}