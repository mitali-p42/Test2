import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InterviewService } from './interview.service';
import { Response } from 'express';

type RequestUser = { id: string; email: string };
type AuthedRequest = { user: RequestUser };

@Controller('interview')
@UseGuards(JwtAuthGuard) // All routes require authentication
export class InterviewController {
  constructor(private readonly service: InterviewService) {}

  // Create a new interview session for a user
  @Post('sessions')
  async createSession(
    @Req() req: AuthedRequest,
    @Body() body: { 
      role: string; 
      interviewType: string; 
      yearsOfExperience?: number;
      skills?: string[];
      totalQuestions?: number; 
    },
  ) {
    return this.service.createSession(
      req.user.id,
      body.role,
      body.interviewType,
      body.yearsOfExperience,
      body.skills,
      body.totalQuestions || 5,
    );
  }

  // Mark a session as started
  @Patch('sessions/:id/start')
  async startSession(@Param('id') sessionId: string) {
    return this.service.startSession(sessionId);
  }

  // Real-time audio chunk transcription endpoint
  @Post('transcribe-chunk')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeChunk(
    @Body() body: { previousContext?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new HttpException('No audio file uploaded', HttpStatus.BAD_REQUEST);
      }

      console.log('🎤 Transcribing chunk:', {
        size: file.size,
        hasContext: !!body.previousContext,
      });

      const transcript = await this.service.transcribeAudioChunk(
        file.buffer,
        body.previousContext || '',
      );

      return { 
        text: transcript,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('❌ Chunk transcription error:', err.message);
      throw new HttpException(
        { success: false, error: 'Transcription failed', message: err.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Record tab switch events to detect focus loss (anti-cheating)
  @Post('sessions/:id/tab-switch')
  async recordTabSwitch(@Param('id') sessionId: string) {
    try {
      const result = await this.service.recordTabSwitch(sessionId);
      
      console.log('📊 Tab switch recorded:', {
        sessionId,
        count: result.tabSwitches,
        shouldTerminate: result.shouldTerminate,
      });

      return {
        tabSwitches: result.tabSwitches,
        shouldTerminate: result.shouldTerminate,
        remainingWarnings: Math.max(0, 2 - result.tabSwitches),
        message: result.shouldTerminate 
          ? 'Interview terminated due to repeated tab switches'
          : result.tabSwitches === 1
          ? 'First warning: Please stay on this tab'
          : 'Final warning: One more tab switch will terminate the interview',
      };
    } catch (err: any) {
      console.error('❌ Tab switch recording failed:', err.message);
      throw new HttpException(
        { success: false, error: 'Failed to record tab switch', message: err.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🔍 Get session metadata and current progress
  @Get('sessions/:id')
  async getSession(@Param('id') sessionId: string) {
    return this.service.getSession(sessionId);
  }

  // Convert question text to spoken audio (TTS)
  @Post('tts')
  async textToSpeech(
    @Body() body: { text: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const audioBuffer = await this.service.textToSpeech(body.text);
    
    res.set({
      'Content-Type': 'audio/mp3',
      'Content-Length': audioBuffer.length,
    });
    
    return new StreamableFile(audioBuffer);
  }

  // Generate next interview question dynamically
  @Post('sessions/:id/next-question')
  async nextQuestion(
    @Param('id') sessionId: string,
    @Body() body: { yearsOfExperience?: number | string },
  ) {
    try {
      console.log('📝 Generating next question for session:', sessionId);
      
      const result = await this.service.generateNextQuestion(
        sessionId,
        body.yearsOfExperience || 0,
      );

      console.log('✅ Returning question with difficulty:', {
        questionNumber: result.questionNumber,
        difficulty: result.difficulty,
        category: result.category,
        hasAudio: !!result.audioBuffer,
      });

      return {
        question: result.question,
        questionNumber: result.questionNumber,
        difficulty: result.difficulty,
        category: result.category,
        audioBase64: result.audioBuffer.toString('base64'), // Encode for frontend playback
      };
    } catch (err: any) {
      console.error('❌ Next question error:', err.message);
      throw new HttpException(
        { success: false, error: 'Failed to generate question', message: err.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Retrieve AI-generated hint for a specific question
  @Post('sessions/:id/hint')
  async getQuestionHint(
    @Param('id') sessionId: string,
    @Body() body: { questionNumber: number },
  ) {
    try {
      console.log('💡 Hint requested:', { sessionId, questionNumber: body.questionNumber });
      
      const hint = await this.service.getQuestionHint(sessionId, body.questionNumber);
      
      console.log('✅ Hint generated successfully');
      return hint;
    } catch (error: any) {
      console.error('❌ Hint request failed:', error.message);
      
      // Specific error types mapped to HTTP statuses
      if (error.message?.includes('only available for hard')) {
        throw new HttpException(
          'Hints are only available for hard difficulty questions',
          HttpStatus.FORBIDDEN,
        );
      }
      if (error.message?.includes('not found')) {
        throw new HttpException('Question not found', HttpStatus.NOT_FOUND);
      }
      
      throw new HttpException(
        error.message || 'Failed to generate hint',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Submit an answer with recorded audio; triggers transcription + evaluation
  @Post('sessions/:id/submit-answer')
  @UseInterceptors(FileInterceptor('audio'))
  async submitAnswer(
    @Param('id') sessionId: string,
    @Body() body: { questionNumber: string; yearsOfExperience?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    console.log('📥 Received answer submission:', {
      sessionId,
      questionNumber: body.questionNumber,
      hasFile: !!file,
      fileSize: file?.size,
    });
    
    if (!file) {
      throw new HttpException('No audio file uploaded', HttpStatus.BAD_REQUEST);
    }

    // Delegate transcription + multi-agent evaluation to service layer
    const { transcript, evaluation } = await this.service.processAnswer(
      sessionId,
      parseInt(body.questionNumber, 10),
      file.buffer,
      body.yearsOfExperience || 0,
    );

    return { transcript, evaluation };
  }

  // Mark session as completed and timestamp it
  @Patch('sessions/:id/complete')
  async completeSession(@Param('id') sessionId: string) {
    return this.service.completeSession(sessionId);
  }

  // Retrieve all question–answer records for this session
  @Get('sessions/:id/qa')
  async getSessionQAs(@Param('id') sessionId: string) {
    return this.service.getSessionQAs(sessionId);
  }

  // Fetch summarized results and overall evaluation metrics
  @Get('sessions/:id/results')
  async getSessionResults(@Param('id') sessionId: string) {
    return this.service.getSessionResults(sessionId);
  }
}