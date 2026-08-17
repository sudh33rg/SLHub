import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Time-series usage record per site. One row per site per day (or per sync).
 * The dashboard/analytics are computed from this table so traffic trends are real
 * and persistent rather than hardcoded.
 */
@Entity('usage_records')
@Index(['siteId', 'periodStart'])
export class UsageRecord {
  @PrimaryGeneratedColumn() id!: number;
  @Column() siteId!: number;
  /** ISO start of the period this record covers (e.g. day or month bucket). */
  @Column({ type: 'datetime' }) periodStart!: Date;
  @Column({ default: 'day' }) granularity!: string;
  /** Data downloaded in GB during the period. */
  @Column({ type: 'real', default: 0 }) downloadGb!: number;
  /** Data uploaded in GB during the period. */
  @Column({ type: 'real', default: 0 }) uploadGb!: number;
  /** Average downstream throughput in Mbps during the period. */
  @Column({ type: 'real', default: 0 }) avgDownloadMbps!: number;
  /** Average upstream throughput in Mbps during the period. */
  @Column({ type: 'real', default: 0 }) avgUploadMbps!: number;
  /** Average latency in ms during the period. */
  @Column({ type: 'real', default: 0 }) avgLatencyMs!: number;
  /** Whether this record came from a live sync (true) or was simulated. */
  @Column({ default: false }) simulated!: boolean;
  @CreateDateColumn() createdAt!: Date;
}
