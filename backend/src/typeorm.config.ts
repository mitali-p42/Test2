import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './users/user.entity';
import { InterviewProfile } from './interview-profile/interview-profile.entity';
import { InterviewSession } from './interview/interview-session.entity'; 
import { InterviewQA } from './interview/interview-qa.entity';  

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: config.get<string>('DATABASE_URL')!,
  applicationName: 'nest-api',
  logging: ['error', 'warn'],
  synchronize: false,
  migrationsRun: false,
  autoLoadEntities: false,
  entities: [User, InterviewProfile, InterviewSession, InterviewQA],
});
