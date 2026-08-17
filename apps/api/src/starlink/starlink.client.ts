import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { TokenService, StarlinkCredentials } from './token.service';
import {
  StarlinkAccount,
  DataUsageServiceLine,
  TelemetryQueryResponse,
  ServiceLine,
  UserTerminal,
  BillingBalance,
  InvoiceSummary,
} from './starlink.types';

const BASE = 'https://starlink.com/api/public';
const DEFAULT_TIMEOUT = 20000;

/**
 * Typed client for the Starlink V2 Business Network API. Every method takes the
 * service-account credentials for the target Starlink account and injects a fresh
 * bearer token (obtained via TokenService). On a 401 we invalidate the cached
 * token and retry once. All endpoints are account-scoped.
 *
 * Response shapes follow the V2 `ServiceResponse` envelope: every payload is
 * `{ content, errors, warnings, isValid }` — `content` holds the actual data.
 */
@Injectable()
export class StarlinkClient {
  private readonly log = new Logger(StarlinkClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly token: TokenService) {
    this.http = axios.create({ baseURL: BASE, timeout: DEFAULT_TIMEOUT });
  }

  private async headers(creds: StarlinkCredentials): Promise<Record<string, string>> {
    const token = await this.token.getToken(creds);
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  /** Unwrap the V2 ServiceResponse envelope and surface errors.
   *  - `{ content: {...} }` → the inner content.
   *  - paginated content `{ content: { results: [...] } }` → the `results` array.
   *  - payloads returned without an envelope are passed through untouched. */
  private unwrap<T>(raw: any): T {
    if (raw?.errors?.length || raw?.isValid === false) {
      const details = raw.errors ?? raw.warnings ?? raw.information ?? 'Invalid response';
      throw new Error(`Starlink API response invalid: ${JSON.stringify(details)}`);
    }
    if (raw && raw.content !== undefined) {
      const c = raw.content;
      if (c && Array.isArray(c.results)) return c.results as T;
      return c as T;
    }
    return raw as T;
  }

  private async get<T>(creds: StarlinkCredentials, path: string, params?: Record<string, any>): Promise<T> {
    try {
      const r = await this.http.get(`/v2${path}`, { headers: await this.headers(creds), params });
      return this.unwrap<T>(r.data);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        this.token.invalidate(creds.clientId);
        const r = await this.http.get(`/v2${path}`, { headers: await this.headers(creds), params });
        return this.unwrap<T>(r.data);
      }
      throw this.wrap(e);
    }
  }

  private async post<T>(creds: StarlinkCredentials, path: string, body?: any): Promise<T> {
    try {
      const r = await this.http.post(`/v2${path}`, body ?? {}, { headers: await this.headers(creds) });
      return this.unwrap<T>(r.data);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        this.token.invalidate(creds.clientId);
        const r = await this.http.post(`/v2${path}`, body ?? {}, { headers: await this.headers(creds) });
        return this.unwrap<T>(r.data);
      }
      throw this.wrap(e);
    }
  }

  private wrap(e: any): Error {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const msg = `Starlink API error${status ? ` (${status})` : ''}: ${JSON.stringify(data ?? e?.message ?? e)}`;
    return new Error(msg);
  }

  /** GET /v2/account — basic account info; good for validating credentials. */
  getAccount(creds: StarlinkCredentials): Promise<StarlinkAccount> {
    return this.get<StarlinkAccount>(creds, '/account');
  }

  /** POST /v2/data-usage/query — daily usage across billing cycles for the account. */
  queryDataUsage(
    creds: StarlinkCredentials,
    body: { serviceLineNumbers?: string[]; previousBillingCycles?: number; activeServiceLinesOnly?: boolean; queryStartDate?: string } = {},
  ): Promise<DataUsageServiceLine[]> {
    return this.post<DataUsageServiceLine[]>(creds, '/data-usage/query', {
      serviceLineNumbers: body.serviceLineNumbers ?? [],
      ...(body.queryStartDate ? { queryStartDate: body.queryStartDate } : { previousBillingCycles: body.previousBillingCycles ?? 1 }),
      activeServiceLinesOnly: body.activeServiceLinesOnly ?? true,
    });
  }

  /** POST /v2/telemetry/query — most recent health snapshot for requested devices. */
  queryTelemetry(
    creds: StarlinkCredentials,
    body: { includeUserTerminals?: boolean; userTerminalIds?: string[]; includeRouters?: boolean; routerIds?: string[] } = {},
  ): Promise<TelemetryQueryResponse> {
    return this.post<TelemetryQueryResponse>(creds, '/telemetry/query', {
      includeUserTerminals: body.includeUserTerminals ?? true,
      userTerminalIds: body.userTerminalIds ?? [],
      includeRouters: body.includeRouters ?? false,
      routerIds: body.routerIds ?? [],
    });
  }

  /**
   * GET /v2/service-lines — list service lines on the account.
   * V2 returns a paginated envelope; we return the `results` array.
   * NOTE: this endpoint exists in V2; map fields to the V2 `ServiceLineResponse`
   * shape (serviceLineNumber, nickname, servicePlan, ...).
   */
  async getServiceLines(creds: StarlinkCredentials): Promise<ServiceLine[]> {
    return this.getPaged<ServiceLine>(creds, '/service-lines');
  }

  /**
   * GET /v2/user-terminals — list user terminals on the account.
   * V2 returns `{ content: { results: UserTerminalResponseV2[] } }` where the
   * device identifier is `userTerminalId` (not `id`).
   */
  getUserTerminals(
    creds: StarlinkCredentials,
    filters: { serviceLineNumbers?: string[]; userTerminalIds?: string[]; hasServiceLine?: boolean; searchString?: string } = {},
  ): Promise<UserTerminal[]> {
    return this.getPaged<UserTerminal>(creds, '/user-terminals', {
      ...(filters.serviceLineNumbers?.length ? { serviceLineNumbers: filters.serviceLineNumbers } : {}),
      ...(filters.userTerminalIds?.length ? { userTerminalIds: filters.userTerminalIds } : {}),
      ...(filters.hasServiceLine === undefined ? {} : { hasServiceLine: filters.hasServiceLine }),
      ...(filters.searchString ? { searchString: filters.searchString } : {}),
    });
  }

  private async getPaged<T>(creds: StarlinkCredentials, path: string, params: Record<string, any> = {}): Promise<T[]> {
    const results: T[] = [];
    // V2 documents a page size of 100. Requesting the next page until a short
    // page is returned also handles accounts whose total is an exact multiple.
    for (let page = 0; page < 1000; page++) {
      const batch = await this.get<T[]>(creds, path, { ...params, page });
      results.push(...(batch ?? []));
      if (!batch || batch.length < 100) break;
    }
    return results;
  }

  /** GET /v2/billing/balance — current account balance per currency. */
  getBillingBalance(creds: StarlinkCredentials): Promise<BillingBalance[]> {
    return this.get<BillingBalance[]>(creds, '/billing/balance');
  }

  /** GET /v2/billing/invoices — invoice summaries. */
  getInvoices(creds: StarlinkCredentials): Promise<InvoiceSummary[]> {
    return this.get<InvoiceSummary[]>(creds, '/billing/invoices');
  }
}
