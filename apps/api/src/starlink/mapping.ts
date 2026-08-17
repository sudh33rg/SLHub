import { DataUsageDaily, DataUsageServiceLine, UserTerminalCacheData } from './starlink.types';

export interface DailyUsagePoint {
  /** ISO date string as returned by Starlink (e.g. 2024-04-15T00:00:00+00:00). */
  date: string;
  periodStart: Date;
  /** Total data consumed that day in GB (priority + standard + non-billable). */
  downloadGb: number;
  /** Starlink's data-usage API does not separate upload from download, so upload is 0. */
  uploadGb: number;
}

/** Total GB for a single day = priority + standard + non-billable. */
export function dailyTotalGb(day: DataUsageDaily): number {
  return (day.priorityGB || 0) + (day.standardGB || 0) + (day.nonBillableGB || 0);
}

/**
 * Flatten a service line's billing cycles into a de-duplicated, date-sorted list
 * of daily totals. Overlapping dates (e.g. across cycle boundaries) keep the last seen.
 */
export function mapDataUsageDaily(sl: DataUsageServiceLine): DailyUsagePoint[] {
  const out: DailyUsagePoint[] = [];
  for (const cycle of sl.billingCycles ?? []) {
    for (const d of cycle.dailyDataUsage ?? []) {
      const total = dailyTotalGb(d);
      out.push({ date: d.date, periodStart: new Date(d.date), downloadGb: +total.toFixed(2), uploadGb: 0 });
    }
  }
  const byDate: Record<string, DailyUsagePoint> = {};
  for (const p of out) byDate[p.date] = p;
  const dedup = Object.keys(byDate).map((k) => byDate[k]);
  return dedup.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Sum real data usage (download + upload) across the trailing `windowDays`
 * window. Mirrors the Analytics "Period Traffic (last N days)" aggregate exactly
 * so the Sites table's Usage column and the Analytics page can never disagree.
 */
export function periodUsageGb(days: DailyUsagePoint[], windowDays = 30): number {
  const cutoff = trailingWindowStart(windowDays);
  return days
    .filter((d) => d.periodStart.getTime() >= cutoff)
    .reduce((sum, d) => sum + d.downloadGb + d.uploadGb, 0);
}

/** Start of the UTC calendar day at the edge of a trailing window. Daily
 * Starlink records should not disappear because a sync ran a few milliseconds
 * after the exact N*24-hour boundary. */
export function trailingWindowStart(windowDays: number): number {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - windowDays);
  return start.getTime();
}

export interface TelemetrySnapshot {
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
}

/**
 * Map the most-recent user-terminal telemetry cache entry to the snapshot fields
 * used by the dashboard. Throughput comes from downlink/uplink; latency from the
 * Starlink PoP ping (falling back to internet ping).
 */
export function mapTelemetrySnapshot(ut?: UserTerminalCacheData): TelemetrySnapshot {
  if (!ut) return { downloadMbps: 0, uploadMbps: 0, latencyMs: 0 };
  const snapshot: TelemetrySnapshot = {
    // V2 cache responses use the *Mbps and *Avg names. The shorter aliases
    // are accepted for compatibility with older fixtures.
    downloadMbps: ut.downlinkThroughputMbps ?? ut.downlinkThroughput ?? 0,
    uploadMbps: ut.uplinkThroughputMbps ?? ut.uplinkThroughput ?? 0,
    latencyMs: ut.popPingLatencyMsAvg ?? ut.popPingLatencyMs ?? ut.internetPingLatencyMs ?? 0,
  };
  const raw = ut as UserTerminalCacheData & Record<string, any>;
  const terminalState = raw.state ?? raw.status;
  if (terminalState !== undefined) snapshot.terminalState = String(terminalState);
  if (raw.softwareVersion !== undefined) snapshot.softwareVersion = String(raw.softwareVersion);
  if (raw.uptimeSeconds !== undefined) snapshot.uptimeSeconds = Number(raw.uptimeSeconds);
  if (raw.obstructionPercentTime !== undefined) snapshot.obstructionPercent = Number(raw.obstructionPercentTime);
  if (raw.popPingDropRateAvg !== undefined) snapshot.popPingDropRate = Number(raw.popPingDropRateAvg);
  if (raw.signalQuality !== undefined) snapshot.signalQuality = Number(raw.signalQuality);
  const alertKeys = ['alertHighTimeObstruction', 'alertDataOverageRateLimited', 'alertDisabledNoActiveServiceLine', 'alertObstruction', 'alertHighPingDropRate', 'alertNoSignal'];
  if (alertKeys.some((key) => key in raw)) snapshot.alertCount = alertKeys.reduce((count, key) => count + (raw[key] === true ? 1 : 0), 0);
  return snapshot;
}

/**
 * Resolve the device id for a site. Prefer an explicitly stored deviceId, then
 * fall back to a serviceLineNumber -> deviceId map built from the terminals list.
 */
export const resolveDeviceId = (
  serviceLineNumber: string | undefined,
  deviceId: string | undefined,
  serviceLineToDevice: Record<string, string>,
): string | undefined => deviceId || (serviceLineNumber ? serviceLineToDevice[serviceLineNumber] : undefined);
