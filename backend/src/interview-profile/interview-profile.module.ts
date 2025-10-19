import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewProfile } from './interview-profile.entity';
import { InterviewProfileService } from './interview-profile.service';
import { InterviewProfileController } from './interview-profile.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewProfile]),
    UsersModule, // 
  ],
  controllers: [InterviewProfileController],
  providers: [InterviewProfileService],
  exports: [InterviewProfileService], 
})
export class InterviewProfileModule {}