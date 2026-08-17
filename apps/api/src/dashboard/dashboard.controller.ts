import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SitesService } from '../sites/sites.service';
import { UsageRecord } from '../sites/usage-record.entity';
import { Site } from '../sites/site.entity';
import { trailingWindowStart } from '../starlink/mapping';

@UseGuards(AuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private sites: SitesService,
    @InjectRepository(UsageRecord) private usage: Repository<UsageRecord>,
    @InjectRepository(Site) private siteRepo: Repository<Site>,
  ) {}

  @Get('summary') async summary(@Request() req: any) {
    const s = await this.sites.findAll(req.user.role, req.user.username);
    const online = s.filter((x: any) => x.status === 'Online').length;
    const usageGb = s.reduce((a: number, x: any) => a + (x.usageGb || 0), 0);
    const totalDown = s.reduce((a: number, x: any) => a + (x.downloadMbps || 0), 0);
    const avgLatency = s.length ? s.reduce((a: number, x: any) => a + (x.latencyMs || 0), 0) / s.length : 0;

    // Usage in the last 30 days (real, from time-series).
    const rows = await this.usage.find();
    const ownedIds = new Set(s.map((x: any) => x.id));
    const last30 = rows.filter((r) => {
      const timestamp = new Date(r.periodStart).getTime();
      const site = s.find((x: any) => x.id === r.siteId);
      return timestamp >= trailingWindowStart(30) && timestamp <= Date.now() && ownedIds.has(r.siteId) && (req.user.role === 'admin' || site?.ownerUsername === req.user.username);
    });
    const monthGb = last30.reduce((a, r) => a + r.downloadGb + r.uploadGb, 0);

    return {
      totalSites: s.length,
      onlineSites: online,
      offlineSites: s.length - online,
      usageGb: +usageGb.toFixed(1),
      monthGb: +monthGb.toFixed(1),
      // Telemetry is already expressed in megabits/second. Keep three decimals
      // so low-but-real links do not collapse to a misleading 0 Mbps.
      avgThroughputMbps: +((totalDown / (s.length || 1))).toFixed(3),
      avgLatencyMs: +avgLatency.toFixed(1),
      healthPercent: s.length ? Math.round((online / s.length) * 100) : 0,
    };
  }
}
