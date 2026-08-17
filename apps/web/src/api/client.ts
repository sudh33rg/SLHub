import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('me');
      if (location.pathname !== '/login') location.reload();
    }
    return Promise.reject(err);
  },
);

export type Role = 'admin' | 'operator' | 'viewer';

export interface Me {
  id: number;
  username: string;
  role: Role;
  ownerName?: string;
  active: boolean;
}

export interface Site {
  id: number;
  name: string;
  accountName: string;
  plan: string;
  status: string;
  usageGb: number;
  dataLimitGb?: number;
  topupUsedGb?: number;
  ipPolicy?: string;
  billingCycle?: string;
  billingCycleStart?: string;
  billingCycleEnd?: string;
  autoTopup?: boolean;
  subscriptionStatus?: string;
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  lastSyncAt?: string;
  notes?: string;
  ownerUsername?: string;
  apiAccountId?: number;
  serviceLineNumber?: string;
  deviceId?: string;
  lastSyncMode?: string;
  lastError?: string;
  terminalState?: string;
  softwareVersion?: string;
  uptimeSeconds?: number;
  obstructionPercent?: number;
  popPingDropRate?: number;
  signalQuality?: number;
  alertCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: number;
  siteId: number;
  periodStart: string;
  granularity: string;
  downloadGb: number;
  uploadGb: number;
  avgDownloadMbps: number;
  avgUploadMbps: number;
  avgLatencyMs: number;
  simulated: boolean;
}

export interface ApiAccount {
  id: number;
  name: string;
  clientId: string;
  status: string;
  secretConfigured: boolean;
}

export interface ApiAccountOverview {
  ok: boolean;
  account?: { accountNumber?: string; accountName?: string; enterpriseName?: string; regionCode?: string; mode?: string };
  serviceLines?: Array<any>;
  terminals?: Array<any>;
  serviceLineCount: number;
  terminalCount: number;
  balance: Array<{ currency?: string; balance?: number; dueAmount?: number }>;
  invoices: Array<{ invoiceId?: string; invoiceDate?: string; amountDue?: number; amount?: number; currency?: string; status?: string }>;
  usageServiceLines?: Array<any>;
  addresses?: Array<any>;
  products?: Array<any>;
  dataPools?: Array<any>;
  dataPoolUsage?: unknown;
  fetchedAt: string;
}

export const fmtGb = (n: number) => `${n >= 1024 ? (n / 1024).toFixed(2) + ' TB' : n.toFixed(1) + ' GB'}`;
/** Starlink telemetry throughput fields are Mbps (megabits/sec), not bytes. */
export const fmtMbps = (n?: number) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const value = Number(n);
  return `${value >= 100 ? value.toFixed(1) : value >= 1 ? value.toFixed(2) : value.toFixed(3)} Mbps`;
};
export const fmtCycle = (start?: string, end?: string) => {
  if (!start && !end) return '—';
  const format = (value?: string) => {
    if (!value) return '—';
    const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };
  return `${format(start)} – ${format(end)}`;
};
export const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString() : '—');
export const initial = (s?: string) => (s ? s.trim()[0]?.toUpperCase() : '?');
export const getSites = async (): Promise<Site[]> => (await api.get('/sites')).data;
