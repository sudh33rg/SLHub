import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './site.entity';
import { StarlinkSyncService } from './starlink-sync.service';
import { Role } from '../auth/user.entity';

/** Admins see every site; operators/viewers see only sites they own. */
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private r: Repository<Site>,
    private sync: StarlinkSyncService,
  ) {}

  async findAll(role: Role, username: string, q = '') {
    const rows = await this.r.find({ order: { name: 'ASC' } });
    // Admin sees everything. Operators/viewers see ONLY sites assigned to them.
    // Sites with no owner (created by admin, unassigned) are NOT visible to non-admins.
    const scoped = rows.filter((s) => role === 'admin' || s.ownerUsername === username);
    if (!q) return scoped;
    const needle = q.toLowerCase();
    return scoped.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.accountName.toLowerCase().includes(needle),
    );
  }

  async findOne(role: Role, username: string, id: number) {
    const s = await this.r.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    if (role !== 'admin' && s.ownerUsername && s.ownerUsername !== username)
      throw new ForbiddenException('You do not own this site');
    return s;
  }

  async create(role: Role, username: string, d: Partial<Site>) {
    if (role !== 'admin') d.ownerUsername = username; // owners can't assign to others
    const s = this.r.create({ ...d, lastSyncAt: new Date() });
    const saved = await this.r.save(s);
    // Pull REAL Starlink data immediately if the site is linked to a V2 API account.
    // Unlinked sites have no data (this is a real-time tool, not a demo — no fabrication).
    if (this.sync.isLinked(saved)) {
      try {
        await this.sync.backfill(saved);
      } catch (e: any) {
        this.logSyncError(saved.id, e);
      }
    }
    return this.findOne(role, username, saved.id);
  }

  async update(role: Role, username: string, id: number, d: Partial<Site>) {
    const s = await this.findOne(role, username, id);
    if (d.ownerUsername !== undefined && role !== 'admin') delete d.ownerUsername; // only admin reassigns
    Object.assign(s, d);
    return this.r.save(s);
  }

  async remove(role: Role, username: string, id: number) {
    const s = await this.findOne(role, username, id);
    await this.r.remove(s);
    return { ok: true };
  }

  /** Trigger a single-site live sync. Linked sites pull real data; unlinked throw. */
  async syncSite(role: Role, username: string, id: number) {
    const s = await this.findOne(role, username, id);
    const record = await this.sync.recordSync(s);
    return { record, site: await this.findOne(role, username, id) };
  }

  /**
   * Refresh: live-sync every linked site the caller can see, using each site's own
   * API Account client Id + secret. Unlinked sites are skipped (no data fabricated).
   * Returns a per-site summary so the UI can show what succeeded / failed.
   */
  async refresh(role: Role, username: string) {
    const sites = await this.findAll(role, username);
    const linked = sites.filter((s) => this.sync.isLinked(s));
    const results: { id: number; name: string; ok: boolean; mode?: string; error?: string | null }[] = [];
    for (const s of linked) {
      try {
        await this.sync.recordSync(s);
        const refreshed = await this.r.findOne({ where: { id: s.id } });
        results.push({ id: s.id, name: s.name, ok: true, mode: refreshed?.lastSyncMode, error: refreshed?.lastError ?? null });
      } catch (e: any) {
        results.push({ id: s.id, name: s.name, ok: false, error: e?.message || String(e) });
      }
    }
    return { refreshed: results.length, linked: linked.length, results };
  }

  async history(siteId: number, role: Role, username: string, days = 30) {
    const s = await this.r.findOne({ where: { id: siteId } });
    if (!s) throw new NotFoundException();
    if (role !== 'admin' && s.ownerUsername && s.ownerUsername !== username)
      throw new ForbiddenException('You do not own this site');
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    return this.sync.history(siteId, from, to);
  }

  private logSyncError(siteId: number, e: any) {
    // Persist the failure on the site so it's visible in the UI, but don't crash create().
    void this.r
      .createQueryBuilder()
      .update(Site)
      .set({ lastError: e?.message || String(e), lastSyncMode: 'error' })
      .where('id = :id', { id: siteId })
      .execute()
      .catch(() => undefined);
  }
}
