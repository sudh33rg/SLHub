import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { SitesModule } from '../sites/sites.module';
import { UsageRecord } from '../sites/usage-record.entity';
import { Site } from '../sites/site.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SitesModule, TypeOrmModule.forFeature([UsageRecord, Site]), AuthModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
