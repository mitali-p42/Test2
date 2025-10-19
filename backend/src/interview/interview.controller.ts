// backend/src/interview/interview.controller.ts (FIXED)
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
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private readonly service: InterviewService) {}

  @Post('sessions')
  async createSession(
    @Req() req: AuthedRequest,
    @Body() body: { role: string; interviewType: string; yearsOfExperience?: number },
  ) {
    return this.service.createSession(
      req.user.id,
      body.role,
      body.interviewType,
      body.yearsOfExperience,
    );
  }

  @Patch('sessions/:id/start')
  async startSession(@Param('id') sessionId: string) {
    return this.service.startSession(sessionId);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') sessionId: string) {
    return this.service.getSession(sessionId);
  }

  @Post('transcribe-chunk')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeChunk(
    @Body() body: { previousContext?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new HttpException(
          'No audio file uploaded',
          HttpStatus.BAD_REQUEST,
        );
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
        {
          success: false,
          error: 'Transcription failed',
          message: err.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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

  // 🔥 FIXED: Now properly returns difficulty from service
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
        difficulty: result.difficulty, // 🔥 Critical: difficulty is passed through
        category: result.category,
        audioBase64: result.audioBuffer.toString('base64'),
      };
    } catch (err: any) {
      console.error('❌ Next question error:', err.message);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to generate question',
          message: err.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 🆕 Hint endpoint with validation
  @Post('sessions/:id/hint')
  async getQuestionHint(
    @Param('id') sessionId: string,
    @Body() body: { questionNumber: number },
  ) {
    try {
      console.log('💡 Hint requested:', { sessionId, questionNumber: body.questionNumber });
      
      const hint = await this.service.getQuestionHint(sessionId, body.questionNumber);
      
      console.log('✅ Hint generated successfully');
      
      return hint; // 🔥 Return hint object directly (already has correct shape)
    } catch (error: any) {
      console.error('❌ Hint request failed:', error.message);
      
      // Return user-friendly error messages
      if (error.message?.includes('only available for hard')) {
        throw new HttpException(
          'Hints are only available for hard difficulty questions',
          HttpStatus.FORBIDDEN,
        );
      }
      
      if (error.message?.includes('not found')) {
        throw new HttpException(
          'Question not found',
          HttpStatus.NOT_FOUND,
        );
      }
      
      throw new HttpException(
        error.message || 'Failed to generate hint',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
      throw new HttpException(
        'No audio file uploaded',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { transcript, evaluation } = await this.service.processAnswer(
      sessionId,
      parseInt(body.questionNumber, 10),
      file.buffer,
      body.yearsOfExperience || 0,
    );

    return { transcript, evaluation };
  }

  @Patch('sessions/:id/complete')
  async completeSession(@Param('id') sessionId: string) {
    return this.service.completeSession(sessionId);
  }

  @Get('sessions/:id/qa')
  async getSessionQAs(@Param('id') sessionId: string) {
    return this.service.getSessionQAs(sessionId);
  }

  @Get('sessions/:id/results')
  async getSessionResults(@Param('id') sessionId: string) {
    return this.service.getSessionResults(sessionId);
  }
}