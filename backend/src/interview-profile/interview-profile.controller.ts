import { Controller, Get, Post, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InterviewProfileService } from './interview-profile.service';

type RequestUser = { sub: string; email: string };
type AuthedRequest = { user: RequestUser };

@Controller('interview-profile')
export class InterviewProfileController {
  constructor(private readonly service: InterviewProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@Req() req: AuthedRequest) {
    const profile = await this.service.getProfileForUser(req.user.sub);
    return {
      role: profile?.role ?? '—',
      interviewType: profile?.interviewType ?? '—',
      yearsOfExperience: profile?.yearsOfExperience ?? '—',
      skills: profile?.skills ?? [],
      totalQuestions: profile?.totalQuestions ?? 5, 
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup')
  async setupProfile(
    @Req() req: AuthedRequest,
    @Body() body: {
      role: string;
      interviewType: string;
      yearsOfExperience: number;
      skills?: string[];
      totalQuestions?: number;
    }
  ) {
    // Validate totalQuestions range
    const validatedTotal = body.totalQuestions 
      ? Math.min(Math.max(body.totalQuestions, 1), 20)
      : 5;

    const profile = await this.service.upsertProfile(
      req.user.sub,
      req.user.email,
      {
        role: body.role,
        interviewType: body.interviewType,
        yearsOfExperience: body.yearsOfExperience,
        skills: body.skills,
        totalQuestions: validatedTotal, 
      }
    );

    return {
      success: true,
      profile: {
        role: profile?.role,
        interviewType: profile?.interviewType,
        yearsOfExperience: profile?.yearsOfExperience,
        skills: profile?.skills,
        totalQuestions: profile?.totalQuestions,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('total-questions')
  async updateTotalQuestions(
    @Req() req: AuthedRequest,
    @Body() body: { totalQuestions: number }
  ) {
    const validatedTotal = Math.min(Math.max(body.totalQuestions, 1), 20);
    
    const profile = await this.service.getProfileForUser(req.user.sub);
    
    if (profile) {
      const updated = await this.service.upsertProfile(
        req.user.sub,
        req.user.email,
        {
          role: profile.role || undefined,
          interviewType: profile.interviewType || undefined,
          yearsOfExperience: profile.yearsOfExperience || undefined,
          skills: profile.skills,
          totalQuestions: validatedTotal,
        }
      );
      
      return {
        success: true,
        totalQuestions: updated?.totalQuestions,
      };
    }

    return {
      success: false,
      message: 'Profile not found',
    };
  }
}