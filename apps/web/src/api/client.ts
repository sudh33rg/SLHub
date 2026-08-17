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

export const fmtGb = (n: number) => `${n >= 1024 ? (n / 1024).toFixed(2) + ' TB' : n.toFixed(1) + ' GB'}`;
export const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString() : '—');
export const initial = (s?: string) => (s ? s.trim()[0]?.toUpperCase() : '?');
export const getSites = async (): Promise<Site[]> => (await api.get('/sites')).data;
