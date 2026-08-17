import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UsageRecord } from '../sites/usage-record.entity';
import { Site } from '../sites/site.entity';
import { trailingWindowStart } from '../starlink/mapping';

@UseGuards(AuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    @InjectRepository(UsageRecord) private usage: Repository<UsageRecord>,
    @InjectRepository(Site) private sites: Repository<Site>,
  ) {}

  /** Monthly download+upload GB per site (last 12 months), scoped to the caller's sites. */
  @Get('monthly') monthly(@Request() req: any, @Query('siteId') siteId?: string) {
    return this.aggregate(req.user, siteId ? +siteId : undefined, 'month');
  }

  /** Daily download+upload GB (last 30 days). */
  @Get('daily') daily(@Request() req: any, @Query('siteId') siteId?: string) {
    return this.aggregate(req.user, siteId ? +siteId : undefined, 'day');
  }

  /** Throughput (avg Mbps down/up) over time. */
  @Get('throughput') throughput(@Request() req: any, @Query('siteId') siteId?: string) {
    return this.aggregate(req.user, siteId ? +siteId : undefined, 'day', true);
  }

  private async aggregate(user: any, siteId: number | undefined, mode: 'day' | 'month', throughput = false) {
    const rows = await this.usage.find({
      where: siteId ? { siteId } : undefined,
      order: { periodStart: 'ASC' },
    });
    const owned = await this.sites.find();
    const now = Date.now();
    const from = trailingWindowStart(mode === 'month' ? 365 : 30);
    const filtered = rows.filter((r) => {
      const site = owned.find((s) => s.id === r.siteId);
      // Usage records are not cascade-deleted with a site. Ignore orphaned rows
      // so a deleted site can never inflate live totals.
      if (!site) return false;
      // Non-admin callers see only records for sites assigned to them.
      const timestamp = new Date(r.periodStart).getTime();
      return timestamp >= from && timestamp <= now && (user.role === 'admin' || site.ownerUsername === user.username);
    });

    const buckets: Record<string, any> = {};
    for (const r of filtered) {
      const d = new Date(r.periodStart);
      const key = mode === 'month' ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : d.toISOString().slice(0, 10);
      const b = buckets[key] || (buckets[key] = { period: key, downloadGb: 0, uploadGb: 0, avgDownloadMbps: 0, avgUploadMbps: 0, avgLatencyMs: 0, count: 0 });
      b.downloadGb += r.downloadGb;
      b.uploadGb += r.uploadGb;
      b.avgDownloadMbps += r.avgDownloadMbps;
      b.avgUploadMbps += r.avgUploadMbps;
      b.avgLatencyMs += r.avgLatencyMs;
      b.count++;
    }
    const out = Object.keys(buckets).map((k) => { const b = buckets[k]; return {
      period: b.period,
      downloadGb: +b.downloadGb.toFixed(1),
      uploadGb: +b.uploadGb.toFixed(1),
      totalGb: +(b.downloadGb + b.uploadGb).toFixed(1),
      avgDownloadMbps: b.count ? +(b.avgDownloadMbps / b.count).toFixed(3) : 0,
      avgUploadMbps: b.count ? +(b.avgUploadMbps / b.count).toFixed(3) : 0,
      avgLatencyMs: b.count ? +(b.avgLatencyMs / b.count).toFixed(1) : 0,
    }; });
    return throughput ? out.map(({ period, avgDownloadMbps, avgUploadMbps, avgLatencyMs }: any) => ({ period, avgDownloadMbps, avgUploadMbps, avgLatencyMs })) : out;
  }
}
