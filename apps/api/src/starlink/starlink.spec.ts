import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { TokenService } from '../starlink/token.service';
import { StarlinkClient } from '../starlink/starlink.client';
import { mapDataUsageDaily, mapTelemetrySnapshot, dailyTotalGb, resolveDeviceId, periodUsageGb } from '../starlink/mapping';

/**
 * Verifies the real Starlink integration logic WITHOUT network access:
 *  - token caching + 401-driven refresh
 *  - data-usage -> daily map
 *  - telemetry snapshot map
 *  - StarlinkClient request shape (auth header, retry on 401)
 *
 * axios is mocked so no real credentials or network are needed.
 */
vi.mock('axios');
const mockedAxios = axios as unknown as { create: ReturnType<typeof vi.fn> };

function makeInstance(impl: (cfg: any) => any) {
  const instance = { defaults: {}, get: vi.fn(), post: vi.fn() };
  // get/post delegate to impl based on url+method
  instance.get = vi.fn((url: string, cfg: any) => impl({ ...cfg, method: 'get', url }));
  instance.post = vi.fn((url: string, body: any, cfg: any) => impl({ ...cfg, method: 'post', url, body }));
  mockedAxios.create = vi.fn(() => instance);
  return instance;
}

describe('mapping helpers', () => {
  it('sums priority+standard+nonBillable for a day', () => {
    expect(dailyTotalGb({ date: '', priorityGB: 10, optInPriorityGB: 2, standardGB: 5, nonBillableGB: 1 })).toBe(16);
  });

  it('maps billing cycles to sorted, de-duplicated daily points', () => {
    const line = {
      serviceLineNumber: 'SL-1',
      billingCycles: [
        { startDate: '', endDate: '', dailyDataUsage: [
          { date: '2024-04-01T00:00:00+00:00', priorityGB: 1, optInPriorityGB: 0, standardGB: 2, nonBillableGB: 0 },
          { date: '2024-04-02T00:00:00+00:00', priorityGB: 3, optInPriorityGB: 1, standardGB: 1, nonBillableGB: 0 },
        ] },
        { startDate: '', endDate: '', dailyDataUsage: [
          { date: '2024-04-01T00:00:00+00:00', priorityGB: 9, optInPriorityGB: 0, standardGB: 9, nonBillableGB: 0 }, // overlap, deduped (kept)
        ] },
      ],
    } as any;
    const days = mapDataUsageDaily(line);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2024-04-01T00:00:00+00:00');
    expect(days[0].downloadGb).toBe(18); // 1+2+9+9? wait priority(9)+standard(9)=18
    expect(days[1].downloadGb).toBe(4); // 3+1
  });

  it('maps telemetry snapshot from downlink/uplink and pop latency', () => {
    const snap = mapTelemetrySnapshot({ downlinkThroughput: 150, uplinkThroughput: 12, popPingLatencyMs: 30 } as any);
    expect(snap).toEqual({ downloadMbps: 150, uploadMbps: 12, latencyMs: 30 });
    expect(mapTelemetrySnapshot({ downlinkThroughputMbps: 220, uplinkThroughputMbps: 18, popPingLatencyMsAvg: 24 } as any)).toEqual({ downloadMbps: 220, uploadMbps: 18, latencyMs: 24 });
    expect(mapTelemetrySnapshot(undefined)).toEqual({ downloadMbps: 0, uploadMbps: 0, latencyMs: 0 });
  });

  it('periodUsageGb sums trailing-30-day totals and excludes older days', () => {
    const day = (iso: string, gb: number) => ({ date: iso, periodStart: new Date(iso), downloadGb: gb, uploadGb: 0 });
    const now = new Date();
    const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
    // 20.6 GB from 30 days ago (prior billing cycle) + 0 in the last 3 days.
    const days = [day(iso(30), 20.6), day(iso(3), 0), day(iso(0), 0)];
    expect(periodUsageGb(days, 30)).toBeCloseTo(20.6, 5);
    // A 31-day-old day must be excluded from the 30-day window.
    const withOld = [...days, day(iso(31), 99)];
    expect(periodUsageGb(withOld, 30)).toBeCloseTo(20.6, 5);
  });

  it('resolves device id preferring explicit then service line map', () => {
    expect(resolveDeviceId('SL-1', 'ut-X', { 'SL-1': 'ut-A' })).toBe('ut-X');
    expect(resolveDeviceId('SL-1', undefined, { 'SL-1': 'ut-A' })).toBe('ut-A');
    expect(resolveDeviceId('SL-1', undefined, {})).toBeUndefined();
  });
});

describe('TokenService', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('requests a token and caches it across calls', async () => {
    const authInstance = { defaults: {}, post: vi.fn().mockResolvedValue({ data: { access_token: 'TOK', expires_in: 900 } }) };
    mockedAxios.create = vi.fn(() => authInstance);
    const svc = new TokenService();
    const a = await svc.getToken({ clientId: 'c1', clientSecret: 's1' });
    const b = await svc.getToken({ clientId: 'c1', clientSecret: 's1' });
    expect(a).toBe('TOK');
    expect(b).toBe('TOK');
    expect(authInstance.post).toHaveBeenCalledTimes(1); // cached
  });
});

describe('StarlinkClient (mocked http)', () => {
  let instance: any;
  beforeEach(() => {
    instance = makeInstance(() => Promise.resolve({ data: {} }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('attaches a bearer token and hits the v2 path for data-usage', async () => {
    const svc = new TokenService();
    // avoid real network for token: stub getToken
    vi.spyOn(svc, 'getToken').mockResolvedValue('BEARER123');
    const client = new StarlinkClient(svc);
    await client.queryDataUsage({ clientId: 'c', clientSecret: 's' }, { serviceLineNumbers: ['SL-1'] });
    const call = instance.post.mock.calls[0];
    expect(call[0]).toBe('/v2/data-usage/query');
    expect(call[2].headers.Authorization).toBe('Bearer BEARER123');
    expect(call[1]).toMatchObject({ serviceLineNumbers: ['SL-1'], previousBillingCycles: 1 });
  });

  it('retries once on 401 with a fresh token', async () => {
    const svc = new TokenService();
    const tok = vi.spyOn(svc, 'getToken');
    tok.mockResolvedValueOnce('OLD').mockResolvedValueOnce('NEW');
    instance.post = vi.fn()
      .mockRejectedValueOnce({ response: { status: 401, data: 'token_expired' } })
      .mockResolvedValueOnce({ data: { content: { results: [] } } });
    const client = new StarlinkClient(svc);
    const res = await client.queryDataUsage({ clientId: 'c', clientSecret: 's' });
    expect(instance.post).toHaveBeenCalledTimes(2);
    // V2 wraps payloads in a ServiceResponse envelope; the client unwraps to `content.results`.
    expect(res).toEqual([]);
  });

  it('calls the documented v2 telemetry query endpoint with device filters', async () => {
    const svc = new TokenService();
    vi.spyOn(svc, 'getToken').mockResolvedValue('BEARER123');
    instance.post = vi.fn().mockResolvedValue({ data: { content: { userTerminals: { 'ut-1': { downlinkThroughputMbps: 100 } } } } });
    const client = new StarlinkClient(svc);
    const res = await client.queryTelemetry({ clientId: 'c', clientSecret: 's' }, { userTerminalIds: ['ut-1'] });
    expect(instance.post.mock.calls[0][0]).toBe('/v2/telemetry/query');
    expect(instance.post.mock.calls[0][1]).toMatchObject({ includeUserTerminals: true, userTerminalIds: ['ut-1'], includeRouters: false });
    expect(res.userTerminals?.['ut-1']).toMatchObject({ downlinkThroughputMbps: 100 });
  });

  it('rejects invalid v2 service-response envelopes instead of treating them as data', async () => {
    const svc = new TokenService();
    vi.spyOn(svc, 'getToken').mockResolvedValue('BEARER123');
    instance.get = vi.fn().mockResolvedValue({ data: { isValid: false, errors: [{ message: 'permission denied' }] } });
    const client = new StarlinkClient(svc);
    await expect(client.getAccount({ clientId: 'c', clientSecret: 's' })).rejects.toThrow('permission denied');
  });
});
