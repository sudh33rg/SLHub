import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, IsNotEmpty } from 'class-validator';
import { SitesService } from './sites.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';

class SiteDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() accountName!: string;
  @IsString() @IsNotEmpty() plan!: string;
  @IsIn(['Online', 'Offline']) status!: string;
  @IsNumber() @Min(0) @IsOptional() usageGb?: number;
  @IsNumber() @Min(0) @IsOptional() dataLimitGb?: number;
  @IsNumber() @Min(0) @IsOptional() topupUsedGb?: number;
  @IsString() @IsOptional() ipPolicy?: string;
  @IsString() @IsOptional() billingCycle?: string;
  @IsBoolean() @IsOptional() autoTopup?: boolean;
  @IsString() @IsOptional() subscriptionStatus?: string;
  @IsNumber() @Min(0) @IsOptional() downloadMbps?: number;
  @IsNumber() @Min(0) @IsOptional() uploadMbps?: number;
  @IsNumber() @Min(0) @IsOptional() latencyMs?: number;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() ownerUsername?: string;
  @IsNumber() @IsOptional() apiAccountId?: number;
  @IsString() @IsOptional() serviceLineNumber?: string;
  @IsString() @IsOptional() deviceId?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
}

class UpdateSiteDto {
  @IsString() @IsNotEmpty() @IsOptional() name?: string;
  @IsString() @IsNotEmpty() @IsOptional() accountName?: string;
  @IsString() @IsNotEmpty() @IsOptional() plan?: string;
  @IsIn(['Online', 'Offline']) @IsOptional() status?: string;
  @IsNumber() @Min(0) @IsOptional() usageGb?: number;
  @IsNumber() @Min(0) @IsOptional() dataLimitGb?: number;
  @IsNumber() @Min(0) @IsOptional() topupUsedGb?: number;
  @IsString() @IsOptional() ipPolicy?: string;
  @IsString() @IsOptional() billingCycle?: string;
  @IsBoolean() @IsOptional() autoTopup?: boolean;
  @IsString() @IsOptional() subscriptionStatus?: string;
  @IsNumber() @Min(0) @IsOptional() downloadMbps?: number;
  @IsNumber() @Min(0) @IsOptional() uploadMbps?: number;
  @IsNumber() @Min(0) @IsOptional() latencyMs?: number;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() ownerUsername?: string;
  @IsNumber() @IsOptional() apiAccountId?: number;
  @IsString() @IsOptional() serviceLineNumber?: string;
  @IsString() @IsOptional() deviceId?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('sites')
export class SitesController {
  constructor(private s: SitesService) {}

  @Get() all(@Request() req: any, @Query('q') q?: string) {
    return this.s.findAll(req.user.role, req.user.username, q);
  }

  @Get(':id') one(@Request() req: any, @Param('id') id: string) {
    return this.s.findOne(req.user.role, req.user.username, +id);
  }

  @Roles('admin', 'operator')
  @Post() create(@Request() req: any, @Body() d: SiteDto) {
    return this.s.create(req.user.role, req.user.username, d);
  }

  @Roles('admin', 'operator')
  @Patch(':id') update(@Request() req: any, @Param('id') id: string, @Body() d: UpdateSiteDto) {
    return this.s.update(req.user.role, req.user.username, +id, d);
  }

  @Roles('admin', 'operator')
  @Delete(':id') remove(@Request() req: any, @Param('id') id: string) {
    return this.s.remove(req.user.role, req.user.username, +id);
  }

  @Roles('admin')
  @Post('sync-all') syncAll(@Request() req: any) {
    return this.s.refresh(req.user.role, req.user.username);
  }

  @Roles('admin', 'operator')
  @Post('refresh') refresh(@Request() req: any) {
    return this.s.refresh(req.user.role, req.user.username);
  }

  @Roles('admin', 'operator')
  @Post(':id/sync') sync(@Request() req: any, @Param('id') id: string) {
    return this.s.syncSite(req.user.role, req.user.username, +id);
  }

  @Get(':id/history') history(@Request() req: any, @Param('id') id: string, @Query('days') days?: string) {
    return this.s.history(+id, req.user.role, req.user.username, days ? +days : 30);
  }
}
