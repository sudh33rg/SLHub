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
  };
}

export interface UserTerminal {
  userTerminalId: string;
  state?: string;
  nickname?: string;
  kitSerialNumber?: string;
  dishSerialNumber?: string;
  serviceLineNumber?: string;
}

export interface BillingBalance {
  currency?: string;
  balance?: number;
}

export interface InvoiceSummary {
  invoiceId?: string;
  invoiceDate?: string;
  amountDue?: number;
  currency?: string;
  status?: string;
}
