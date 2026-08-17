import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { UsageRecord } from '../sites/usage-record.entity';
import { Site } from '../sites/site.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord, Site]), AuthModule],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
