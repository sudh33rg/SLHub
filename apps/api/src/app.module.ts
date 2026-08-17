import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { SitesModule } from './sites/sites.module';
import { AccountsModule } from './accounts/accounts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { SeedService } from './seed.service';
import { Site } from './sites/site.entity';
import { UsageRecord } from './sites/usage-record.entity';
import { ApiAccount } from './accounts/api-account.entity';
import { User } from './auth/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_PATH || 'data/starlink.db',
      entities: [User, Site, UsageRecord, ApiAccount],
      synchronize: process.env.DB_SYNCHRONIZE === 'true' || (process.env.DB_SYNCHRONIZE !== 'false' && process.env.NODE_ENV !== 'production'),
    }),
    TypeOrmModule.forFeature([User, Site]),
    AuthModule,
    SitesModule,
    AccountsModule,
    AnalyticsModule,
    DashboardModule,
    UsersModule,
  ],
  providers: [
    SeedService,
  ],
})
export class AppModule {}
