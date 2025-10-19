import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Req, 
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InterviewProfileService } from './interview-profile.service';

type RequestUser = { id: string; email: string; userType?: 'candidate' | 'recruiter' };
type AuthedRequest = { user: RequestUser };

@Controller('interview-profile')
export class InterviewProfileController {
  constructor(private readonly service: InterviewProfileService) {}

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
    const validatedTotal = body.totalQuestions 
      ? Math.min(Math.max(body.totalQuestions, 1), 20)
      : 5;

    const profile = await this.service.upsertProfile(
      req.user.id,
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
  @Get('me')
  async getMyProfile(@Req() req: AuthedRequest) {
    console.log('🔍 REQUEST USER ID:', req.user.id);
    const profile = await this.service.getProfileForUser(req.user.id);
    console.log('📄 FETCHED PROFILE:', JSON.stringify(profile, null, 2));
    
    return {
      role: profile?.role ?? '—',
      interviewType: profile?.interviewType ?? '—',
      yearsOfExperience: profile?.yearsOfExperience ?? '—',
      skills: profile?.skills ?? [],
      totalQuestions: profile?.totalQuestions ?? 5,
      companyName: profile?.companyName ?? null,
      createdByRecruiter: profile?.createdByRecruiter ?? false,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('total-questions')
  async updateTotalQuestions(
    @Req() req: AuthedRequest,
    @Body() body: { totalQuestions: number }
  ) {
    const validatedTotal = Math.min(Math.max(body.totalQuestions, 1), 20);
    
    const profile = await this.service.getProfileForUser(req.user.id);
    
    if (profile) {
      const updated = await this.service.upsertProfile(
        req.user.id,
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

  // 🆕 Recruiter creates candidate profile
  @UseGuards(JwtAuthGuard)
  @Post('create-candidate')
  async createCandidateProfile(
    @Req() req: AuthedRequest,
    @Body() body: {
      candidateEmail: string;
      role: string;
      interviewType: string;
      yearsOfExperience?: number;
      skills: string[];
      totalQuestions?: number;
      companyName: string;
    }
  ) {
    // Verify user is a recruiter
    if (req.user.userType !== 'recruiter') {
      throw new ForbiddenException('Only recruiters can create candidate profiles');
    }

    const profile = await this.service.createCandidateProfile(
      body.candidateEmail,
      req.user.id,
      {
        role: body.role,
        interviewType: body.interviewType,
        yearsOfExperience: body.yearsOfExperience,
        skills: body.skills || [],
        totalQuestions: body.totalQuestions || 5,
        companyName: body.companyName,
      }
    );

    return {
      success: true,
      message: 'Candidate profile created successfully',
      profile: {
        email: profile.email,
        role: profile.role,
        interviewType: profile.interviewType,
        companyName: profile.companyName,
        totalQuestions: profile.totalQuestions,
      },
    };
  }

  // 🆕 Get all candidates created by recruiter
  @UseGuards(JwtAuthGuard)
  @Get('my-candidates')
  async getMyCandidates(@Req() req: AuthedRequest) {
    if (req.user.userType !== 'recruiter') {
      throw new ForbiddenException('Only recruiters can view their candidates');
    }

    const profiles = await this.service.getProfilesByRecruiter(req.user.id);

    return {
      success: true,
      candidates: profiles.map(p => ({
        email: p.email,
        role: p.role,
        interviewType: p.interviewType,
        companyName: p.companyName,
        skills: p.skills,
        totalQuestions: p.totalQuestions,
        createdAt: p.createdAt,
      })),
    };
  }
}