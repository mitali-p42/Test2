// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const user = this.repo.create({ email, passwordHash });
    return this.repo.save(user);
  }

  // ✅ Updated to include totalQuestions
  async findByIdWithProfile(id: string) {
    return this.repo
      .createQueryBuilder('u')
      .leftJoin('interview_profiles', 'ip', 'ip.user_id = u.id')
      .where('u.id = :id', { id })
      .select([
        'u.id AS id',
        'u.email AS email',
        'u.created_at AS "createdAt"',
        'ip.role AS role',
        'ip.interview_type AS "interviewType"',
        'ip.years_of_experience AS "yearsOfExperience"',
        'ip.skills AS skills', // 🆕 Add skills
        'ip.total_questions AS "totalQuestions"', // 🆕 Add totalQuestions
      ])
      .getRawOne<{
        id: string;
        email: string;
        createdAt: string;
        role: string | null;
        interviewType: string | null;
        yearsOfExperience: number | null;
        skills: string[] | null;
        totalQuestions: number | null; // 🆕 Add to type
      }>();
  }
}