/** Response shapes for the Starlink V2 Business Network API. */

export interface StarlinkValidationResult {
  code?: string;
  message?: string;
  propertyName?: string;
  [key: string]: unknown;
}

export interface StarlinkServiceResponse<T> {
  errors?: StarlinkValidationResult[];
  warnings?: StarlinkValidationResult[];
  information?: string[];
  isValid?: boolean;
  content?: T;
}

export interface StarlinkAccount {
  accountNumber?: string;
  accountName?: string;
  enterpriseName?: string;
  regionCode?: string;
  mode?: string;
  address?: { postalCode?: string; countryCode?: string };
}

export interface DataUsageDaily {
  date: string;
  priorityGB?: number;
  optInPriorityGB?: number;
  standardGB?: number;
  nonBillableGB?: number;
}

export interface DataUsageBillingCycle {
  startDate: string;
  endDate: string;
  dailyDataUsage: DataUsageDaily[];
  overageLines?: unknown[];
  totalPriorityGB?: number;
  totalStandardGB?: number;
  totalOptInPriorityGB?: number;
  totalNonBillableGB?: number;
  [key: string]: unknown;
}

export interface DataUsageServiceLine {
  accountNumber?: string;
  serviceLineNumber: string;
  startDate?: string;
  endDate?: string;
  billingCycles: DataUsageBillingCycle[];
  servicePlan?: {
    isoCurrencyCode?: string;
    usageLimitGB?: number;
    isOptedIntoOverage?: boolean;
  };
  lastUpdated?: string;
  [key: string]: unknown;
}

export interface DataUsageQueryResponse {
  pageIndex?: number;
  limit?: number;
  isLastPage?: boolean;
  totalCount?: number;
  results: DataUsageServiceLine[];
}

export interface TelemetryQueryResponse {
  userTerminals?: Record<string, UserTerminalCacheData>;
  routers?: Record<string, RouterCacheData>;
}

export type DataUsageServiceResponse = StarlinkServiceResponse<{
  pageIndex?: number;
  limit?: number;
  isLastPage?: boolean;
  totalCount?: number;
  results: DataUsageServiceLine[];
}>;

export interface UserTerminalCacheData {
  userTerminalId?: string;
  deviceId?: string;
  timestamp?: string;
  uptimeSeconds?: number;
  softwareVersion?: string;
  hardwareVersion?: string;
  downlinkThroughputMbps?: number;
  uplinkThroughputMbps?: number;
  popPingLatencyMsAvg?: number;
  popPingDropRateAvg?: number;
  obstructionPercentTime?: number;
  signalQuality?: number;
  alertHighTimeObstruction?: boolean;
  alertDataOverageRateLimited?: boolean;
  alertDisabledNoActiveServiceLine?: boolean;
  // Legacy aliases retained so old cached fixtures remain readable.
  popPingLatencyMs?: number;
  popPingDropRate?: number;
  internetPingLatencyMs?: number;
  internetPingDropRate?: number;
  downlinkThroughput?: number;
  uplinkThroughput?: number;
  alertObstruction?: boolean;
  alertHighPingDropRate?: boolean;
  alertNoSignal?: boolean;
  state?: string;
  status?: string;
  [k: string]: unknown;
}

export interface RouterCacheData {
  deviceId?: string;
  timestamp?: string;
  uptimeSeconds?: number;
  clients?: number;
  popPingLatencyMs?: number;
  popPingDropRate?: number;
  internetPingLatencyMs?: number;
  internetPingDropRate?: number;
  wanRxBytes?: number;
  wanTxBytes?: number;
  [k: string]: unknown;
}

export interface ServiceLine {
  addressReferenceId?: string;
  serviceLineNumber: string;
  nickname?: string;
  productReferenceId?: string;
  startDate?: string;
  endDate?: string;
  state?: string;
  active?: boolean;
  servicePlan?: {
    name?: string;
    productId?: string;
    dataBlockProductId?: string;
    usageLimitGB?: number;
    isoCurrencyCode?: string;
    isOptedIntoOverage?: boolean;
  };
  publicIpEnabled?: boolean;
  isOptedIntoOverage?: boolean;
  automaticTopUp?: boolean;
  userTerminals?: string[];
  [key: string]: unknown;
}

export interface UserTerminal {
  userTerminalId: string;
  state?: string;
  nickname?: string;
  kitSerialNumber?: string;
  dishSerialNumber?: string;
  serviceLineNumber?: string;
  status?: string;
  softwareVersion?: string;
  hardwareVersion?: string;
  uptimeSeconds?: number;
  [key: string]: unknown;
}

export interface BillingBalance {
  currency?: string;
  balance?: number;
  dueAmount?: number;
}

export interface InvoiceSummary {
  invoiceId?: string;
  invoiceDate?: string;
  amountDue?: number;
  amount?: number;
  currency?: string;
  status?: string;
}

export interface StarlinkAddress {
  addressReferenceId?: string;
  nickname?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

export interface StarlinkProduct {
  productId?: string;
  name?: string;
  description?: string;
  serviceType?: string;
  dataBlockGB?: number;
  [key: string]: unknown;
}

export interface StarlinkDataPool {
  dataPoolId?: string;
  name?: string;
  [key: string]: unknown;
}
