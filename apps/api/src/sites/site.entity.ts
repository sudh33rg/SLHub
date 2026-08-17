import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sites')
@Index(['ownerUsername'])
export class Site {
  @PrimaryGeneratedColumn() id!: number;
  @Column() name!: string;
  @Column() accountName!: string;
  @Column() plan!: string;
  @Column({ default: 'Online' }) status!: string;
  /** Configured / current data usage in GB (rolling). */
  @Column({ type: 'real', default: 0 }) usageGb!: number;
  /** Data allowance / cap in GB (real, org-maintained plan limit). null/0 => unlimited / not set. */
  @Column({ type: 'real', nullable: true }) dataLimitGb?: number;
  /** Data consumed from top-ups / priority add-ons in GB (real, org-maintained). */
  @Column({ type: 'real', default: 0 }) topupUsedGb!: number;
  /** IP policy: 'Public IP' or 'Carrier-Grade NAT' (real, org-maintained). */
  @Column({ default: 'Public IP' }) ipPolicy!: string;
  /** Legacy billing-cycle start value retained for backwards compatibility. Live sync populates the range below. */
  @Column({ type: 'date', nullable: true }) billingCycle?: string;
  /** Current live Starlink billing cycle start/end, sourced from data-usage/query. */
  @Column({ type: 'date', nullable: true }) billingCycleStart?: string;
  @Column({ type: 'date', nullable: true }) billingCycleEnd?: string;
  /** Automatic top-up enabled flag (real, org-maintained). */
  @Column({ default: false }) autoTopup!: boolean;
  /** Subscription status: 'Active' | 'Paused' | 'Cancelled' (real, org-maintained). */
  @Column({ default: 'Active' }) subscriptionStatus!: string;
  /** Current downstream throughput in Mbps (live snapshot). */
  @Column({ type: 'real', default: 0 }) downloadMbps!: number;
  /** Current upstream throughput in Mbps (live snapshot). */
  @Column({ type: 'real', default: 0 }) uploadMbps!: number;
  /** Round-trip latency in ms (live snapshot). */
  @Column({ type: 'real', default: 0 }) latencyMs!: number;
  @Column({ nullable: true }) lastSyncAt?: Date;
  @Column({ nullable: true }) notes!: string;
  /** Owner of this site. null => owned by the organization (admins see all). */
  @Column({ nullable: true }) ownerUsername?: string;
  /** Linked Starlink V2 API account id (optional). */
  @Column({ nullable: true }) apiAccountId?: number;
  /** Starlink service line number this site maps to (optional; enables live sync). */
  @Column({ nullable: true }) serviceLineNumber?: string;
  /** Starlink user-terminal device id for live telemetry (optional). */
  @Column({ nullable: true }) deviceId?: string;
  /** How the last sync ran: 'none' (never synced / unlinked), 'live' (Starlink V2 API), or 'error' (live attempt failed). */
  @Column({ default: 'none' }) lastSyncMode!: string;
  /** Latitude for map/geo views (optional). */
  @Column({ type: 'real', nullable: true }) latitude?: number;
  /** Longitude for map/geo views (optional). */
  @Column({ type: 'real', nullable: true }) longitude?: number;
  /** Last sync error message (if any). */
  @Column({ nullable: true }) lastError?: string;
  /** Live terminal health fields from telemetry/query. */
  @Column({ nullable: true }) terminalState?: string;
  @Column({ nullable: true }) softwareVersion?: string;
  @Column({ type: 'real', nullable: true }) uptimeSeconds?: number;
  @Column({ type: 'real', nullable: true }) obstructionPercent?: number;
  @Column({ type: 'real', nullable: true }) popPingDropRate?: number;
  @Column({ type: 'real', nullable: true }) signalQuality?: number;
  @Column({ type: 'integer', nullable: true }) alertCount?: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
