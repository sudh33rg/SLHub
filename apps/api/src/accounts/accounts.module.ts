import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiAccount } from './api-account.entity';
import { Site } from '../sites/site.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { AuthModule } from '../auth/auth.module';
import { StarlinkModule } from '../starlink/starlink.module';
@Module({ imports: [TypeOrmModule.forFeature([ApiAccount, Site]), AuthModule, StarlinkModule], providers: [AccountsService], controllers: [AccountsController], exports: [AccountsService] })
export class AccountsModule {}
