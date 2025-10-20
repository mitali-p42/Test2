import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async register(email: string, password: string, userType: 'candidate' | 'recruiter' = 'candidate') {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.create(email, passwordHash, userType);

    return this.signToken(user.id, user.email, user.userType);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);

    if (!user) {
      throw new NotFoundException('No account found with this email. Please register.');
    }
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Incorrect password. Please try again.');
    }

    return this.signToken(user.id, user.email, user.userType);
  }

  async me(userId: string) {
    console.log('🔍 auth.service.me() called with userId:', userId);
    const user = await this.users.findByIdWithProfile(userId);

    if (!userId) {
      console.error('❌ userId is undefined in me() method!');
      throw new UnauthorizedException('Invalid user ID from token');
    }
   
    if (!user) {
      
      // Fall back to basic user lookup
      const basicUser = await this.users.findById(userId);
      
      if (basicUser) {
        return {
          id: basicUser.id,
          email: basicUser.email,
          createdAt: basicUser.createdAt,
          userType: basicUser.userType,
          role: '—',
          interviewType: '—',
          yearsOfExperience: '—',
          skills: [],
          totalQuestions: 5,
          companyName: null,
          hasProfile: false,
        };
      }
      
      // User truly doesn't exist
      return {
        id: null,
        email: null,
        createdAt: null,
        userType: null,
        role: '—',
        interviewType: '—',
        yearsOfExperience: '—',
        skills: [],
        totalQuestions: 5,
        companyName: null,
        hasProfile: false,
      };
    }

    const hasProfile = !!(user.role || user.interviewType);
    console.log('✅ Returning user data with hasProfile:', hasProfile);

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      userType: user.userType,
      role: user.role ?? '—',
      interviewType: user.interviewType ?? '—',
      yearsOfExperience: user.yearsOfExperience ?? '—',
      skills: user.skills ?? [], 
      totalQuestions: user.totalQuestions ?? 5,
      companyName: user.companyName ?? null,
      hasProfile,
    };
  }

  private signToken(sub: string, email: string, userType: 'candidate' | 'recruiter') {
    const access_token = this.jwt.sign({ sub, email, userType });
    return { access_token, userType };
  }
}