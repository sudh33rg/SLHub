import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
export type Role = 'admin' | 'operator' | 'viewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ unique: true }) username!: string;
  @Column() passwordHash!: string;
  /** RBAC role. admin > operator > viewer. */
  @Column({ type: 'text', default: 'viewer' }) role!: Role;
  /** Human-friendly name shown in the UI (e.g. "Sudheer"). */
  @Column({ nullable: true }) ownerName?: string;
  @Column({ default: true }) active!: boolean;
}
