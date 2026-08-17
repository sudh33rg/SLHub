import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Site } from './site.entity';
import { UsageRecord } from './usage-record.entity';
import { StarlinkClient } from '../starlink/starlink.client';
import { AccountsService } from '../accounts/accounts.service';
import { mapDataUsageDaily, mapTelemetrySnapshot, periodUsageGb } from '../starlink/mapping';

/**
 * Starlink data source — REAL ONLY.
 *
 * Every sync pulls live data from the Starlink V2 Business Network API using the
 * site's linked API Account (client Id + secret, decrypted via AccountsService) and
 * writes the result to the `usage_records` table and the site's live snapshot.
 *
 * There is NO simulated fallback: if a site is not linked to an API account, or the
 * API call fails (bad credentials, network, quota), the sync throws and the error is
 * recorded on the site — we never fabricate data. This keeps the command center a
 * real-time source of truth, not a demo.
 *
 * A single `data-usage/query` returns the full, de-duplicated daily history for the
 * account's current (and optionally prior) billing cycles, so one call is enough to
 * backfill the dashboard's 365-day window from real data.
 */
@Injectable()
export class StarlinkSyncService {
  private readonly log = new Logger(StarlinkSyncService.name);

  constructor(
    @InjectRepository(Site) private sites: Repository<Site>,
    @InjectRepository(UsageRecord) private usage: Repository<UsageRecord>,
    private starlink: StarlinkClient,
    private accounts: AccountsService,
  ) {}

  /** True when the site is linked to a V2 API account + service line and can sync live. */
  isLinked(site: Site): boolean {
    return !!(site.apiAccountId && site.serviceLineNumber);
  }

  /**
   * Sync a site from the real Starlink API.
   * - If the site is linked (apiAccountId + serviceLineNumber), performs a live pull.
   * - If not linked, throws — no simulated data is produced.
   * `daysBack` only selects which day's record is returned; the full history is always
   * fetched and persisted.
   */
  async recordSync(site: Site, opts: { daysBack?: number } = {}): Promise<UsageRecord> {
    const daysBack = opts.daysBack ?? 0;
    if (!this.isLinked(site)) {
      const msg = 'Site is not linked to a Starlink V2 API account + service line; cannot sync real data.';
      site.lastError = msg;
      site.lastSyncMode = 'none';
      await this.sites.save(site);
      throw new Error(msg);
    }
    return this.recordLive(site, daysBack);
  }

  /** Live sync from the Starlink V2 API. Throws on missing credentials or API error. */
  private async recordLive(site: Site, daysBack: number): Promise<UsageRecord> {
    const acc = await this.accounts.credentials(site.apiAccountId!);
    const creds = { clientId: acc.clientId, clientSecret: acc.clientSecret };

    // 1) Daily data usage for the linked service line — current billing cycle.
    const du = await this.starlink.queryDataUsage(creds, {
      serviceLineNumbers: [site.serviceLineNumber!],
      previousBillingCycles: 12,
      activeServiceLinesOnly: true,
    });
    const lines = du ?? [];
    const line = lines.find((l) => l.serviceLineNumber === site.serviceLineNumber);
    if (!line) throw new Error(`Service line ${site.serviceLineNumber} was not returned by Starlink`);
    const days = mapDataUsageDaily(line);

    // 2) Telemetry snapshot (best-effort; a miss here is not fatal for usage, but we
    //    still surface it as a warning on the site rather than faking numbers).
    let snapshot: {
      downloadMbps: number;
      uploadMbps: number;
      latencyMs: number;
      terminalState?: string;
      softwareVersion?: string;
      uptimeSeconds?: number;
      obstructionPercent?: number;
      popPingDropRate?: number;
      signalQuality?: number;
      alertCount?: number;
    } | undefined;
    let telemetryAvailable = false;
    let telemetryError: string | undefined;
    try {
      let deviceId = site.deviceId;
      if (!deviceId) {
        const terminals = await this.starlink.getUserTerminals(creds, { serviceLineNumbers: [site.serviceLineNumber!] });
        deviceId = terminals.find((t) => t.serviceLineNumber === site.serviceLineNumber)?.userTerminalId;
      }
      if (deviceId) {
        const telemetry = await this.starlink.queryTelemetry(creds, { userTerminalIds: [deviceId] });
        const rawTelemetry = telemetry.userTerminals?.[deviceId];
        if (rawTelemetry) {
          snapshot = mapTelemetrySnapshot(rawTelemetry);
          telemetryAvailable = true;
        } else {
          telemetryError = `No telemetry record returned for terminal ${deviceId}.`;
        }
        if (!site.deviceId) site.deviceId = deviceId;
      } else {
        telemetryError = 'No user terminal is linked to this service line — throughput/latency unavailable.';
      }
    } catch (e: any) {
      telemetryError = `Telemetry unavailable: ${e?.message || e}`;
      this.log.warn(`Telemetry lookup failed for site ${site.id}: ${telemetryError}`);
    }

    // Persist the full real history in one pass (idempotent — upserts per UTC day).
    let lastSaved: UsageRecord | undefined;
    for (const d of days) {
      lastSaved = await this.upsertDailyRecord(
        this.usage.create({
          siteId: site.id,
          periodStart: d.periodStart,
          granularity: 'day',
          downloadGb: d.downloadGb,
          uploadGb: 0,
          avgDownloadMbps: 0,
          avgUploadMbps: 0,
          avgLatencyMs: 0,
          simulated: false,
        }),
      );
    }
    if (days.length === 0) throw new Error('Starlink returned no daily usage data for this service line');

    // The billing window is owned by Starlink. Never ask operators to key this
    // in manually when the data-usage response already provides the live cycle.
    const now = Date.now();
    const cycle = line.billingCycles?.find((c) => {
      const start = new Date(c.startDate).getTime();
      const end = new Date(c.endDate).getTime();
      return start <= now && now <= end;
    }) ?? line.billingCycles?.[line.billingCycles.length - 1];
    if (cycle) {
      site.billingCycleStart = cycle.startDate.slice(0, 10);
      site.billingCycleEnd = cycle.endDate.slice(0, 10);
      site.billingCycle = site.billingCycleStart;
    }
    const livePlanName = (line.servicePlan as any)?.name;
    if (livePlanName) site.plan = livePlanName;
    if (line.servicePlan?.usageLimitGB !== undefined) site.dataLimitGb = line.servicePlan.usageLimitGB;
    const lineData = line as any;
    const overage = lineData.isOptedIntoOverage ?? line.servicePlan?.isOptedIntoOverage ?? lineData.automaticTopUp;
    if (overage !== undefined) site.autoTopup = Boolean(overage);
    if (lineData.publicIpEnabled !== undefined) site.ipPolicy = lineData.publicIpEnabled ? 'Public IP' : 'Carrier-Grade NAT';
    if (line.active !== undefined || line.state !== undefined) {
      const state = String(line.state ?? '').toLowerCase();
      site.subscriptionStatus = line.active === false || ['cancelled', 'inactive', 'suspended', 'terminated'].includes(state) ? 'Paused' : 'Active';
    }

    // Update the site's live snapshot from the most recent day + telemetry.
    const latest = days[days.length - 1];
    // `usageGb` is the trailing-30-day total drawn from the SAME persisted records
    // that Analytics aggregates, so the Sites table and the Analytics page always agree.
    const windowGb = periodUsageGb(days, 30);
    site.usageGb = +(windowGb || latest.downloadGb).toFixed(2);
    if (snapshot) {
      site.downloadMbps = snapshot.downloadMbps;
      site.uploadMbps = snapshot.uploadMbps;
      site.latencyMs = snapshot.latencyMs;
      site.terminalState = snapshot.terminalState;
      site.softwareVersion = snapshot.softwareVersion;
      site.uptimeSeconds = snapshot.uptimeSeconds;
      site.obstructionPercent = snapshot.obstructionPercent;
      site.popPingDropRate = snapshot.popPingDropRate;
      site.signalQuality = snapshot.signalQuality;
      site.alertCount = snapshot.alertCount;
      if (telemetryAvailable) {
        const state = String(snapshot.terminalState ?? '').toLowerCase();
        site.status = ['offline', 'inactive', 'suspended', 'no_signal'].includes(state) ? 'Offline' : 'Online';
      }
      if (lastSaved) {
        lastSaved.avgDownloadMbps = snapshot.downloadMbps;
        lastSaved.avgUploadMbps = snapshot.uploadMbps;
        lastSaved.avgLatencyMs = snapshot.latencyMs;
        await this.usage.save(lastSaved);
      }
    }
    site.lastSyncAt = new Date();
    site.lastSyncMode = 'live';
    site.lastError = telemetryError;
    await this.sites.save(site);

    // Return the requested day (default: most recent) so callers get a usable record.
    if (daysBack === 0) return lastSaved!;
    const target = days.find((d) => {
      const deltaDays = Math.floor((Date.now() - d.periodStart.getTime()) / 86400000);
      return deltaDays === daysBack;
    });
    return target ? (await this.usage.findOne({ where: { siteId: site.id, periodStart: target.periodStart } }))! : lastSaved!;
  }

  /** Upsert one UTC day so repeated refreshes do not inflate the time series. */
  private async upsertDailyRecord(record: UsageRecord): Promise<UsageRecord> {
    const sameSiteDays = await this.usage.find({ where: { siteId: record.siteId, granularity: 'day' } });
    const existing = sameSiteDays.find((row) => {
      const delta = Math.abs(row.periodStart.getTime() - record.periodStart.getTime());
      // SQLite/TypeORM may round-trip a local-midnight Date as UTC midnight;
      // a half-day tolerance still cannot collide with an adjacent daily bin.
      return delta < 12 * 60 * 60 * 1000;
    });
    if (existing) {
      existing.downloadGb = record.downloadGb;
      existing.uploadGb = record.uploadGb;
      existing.simulated = record.simulated;
    }
    return this.usage.save(existing ?? record);
  }

  /** Pull the real, full history for a site (used on create + refresh). */
  async backfill(site: Site) {
    await this.recordSync(site);
  }

  /** Most recent day record for a site (for the live snapshot card). */
  async latest(siteId: number) {
    return this.usage.findOne({ where: { siteId }, order: { periodStart: 'DESC' } });
  }

  async history(siteId: number, from?: Date, to?: Date) {
    const where: any = { siteId };
    if (from && to) Object.assign(where, { periodStart: MoreThanOrEqual(from) });
    const rows = await this.usage.find({ where, order: { periodStart: 'ASC' } });
    return rows.filter((r) => !to || r.periodStart <= to);
  }
}
