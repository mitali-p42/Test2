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

  async create(
    email: string, 
    passwordHash: string, 
    userType: 'candidate' | 'recruiter' = 'candidate'
  ): Promise<User> {
    const user = this.repo.create({ email, passwordHash, userType });
    return this.repo.save(user);
  }

  async findByIdWithProfile(id: string) {
    return this.repo
      .createQueryBuilder('u')
      .leftJoin('interview_profiles', 'ip', 'ip.user_id = u.id')
      .where('u.id = :id', { id })
      .select([
        'u.id AS id',
        'u.email AS email',
        'u.user_type AS "userType"',
        'u.created_at AS "createdAt"',
        'ip.role AS role',
        'ip.interview_type AS "interviewType"',
        'ip.years_of_experience AS "yearsOfExperience"',
        'ip.skills AS skills', 
        'ip.total_questions AS "totalQuestions"',
        'ip.company_name AS "companyName"',
        'ip.created_by_recruiter AS "createdByRecruiter"',
      ])
      .getRawOne<{
        id: string;
        email: string;
        userType: 'candidate' | 'recruiter';
        createdAt: string;
        role: string | null;
        interviewType: string | null;
        yearsOfExperience: number | null;
        skills: string[] | null;
        totalQuestions: number | null;
        companyName: string | null;
        createdByRecruiter: boolean | null;
      }>();
  }
}