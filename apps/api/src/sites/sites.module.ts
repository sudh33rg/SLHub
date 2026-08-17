import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './site.entity';
import { UsageRecord } from './usage-record.entity';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { StarlinkSyncService } from './starlink-sync.service';
import { AuthModule } from '../auth/auth.module';
import { StarlinkModule } from '../starlink/starlink.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Site, UsageRecord]), AuthModule, StarlinkModule, AccountsModule],
  providers: [SitesService, StarlinkSyncService],
  controllers: [SitesController],
  exports: [SitesService, StarlinkSyncService],
})
export class SitesModule {}
