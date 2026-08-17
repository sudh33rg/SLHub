import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Role } from '../auth/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private r: Repository<User>) {}

  /** Admin-only list. Never returns password hashes. */
  async list(actorRole: Role) {
    if (actorRole !== 'admin') throw new ForbiddenException('Requires admin');
    const users = await this.r.find({ order: { username: 'ASC' } });
    return users.map((u) => ({ id: u.id, username: u.username, role: u.role, ownerName: u.ownerName, active: u.active }));
  }

  async create(actorRole: Role, username: string, password: string, role: Role, ownerName?: string) {
    if (actorRole !== 'admin') throw new ForbiddenException('Requires admin');
    if (await this.r.findOne({ where: { username } })) throw new ForbiddenException('Username already exists');
    const u = this.r.create({ username, passwordHash: await bcrypt.hash(password, 12), role, ownerName, active: true });
    const saved = await this.r.save(u);
    return { id: saved.id, username: saved.username, role: saved.role, ownerName: saved.ownerName, active: saved.active };
  }

  async update(actorRole: Role, id: number, patch: { role?: Role; ownerName?: string; active?: boolean; password?: string }) {
    if (actorRole !== 'admin') throw new ForbiddenException('Requires admin');
    const u = await this.r.findOne({ where: { id } });
    if (!u) throw new NotFoundException();
    if (patch.role) u.role = patch.role;
    if (patch.ownerName !== undefined) u.ownerName = patch.ownerName;
    if (patch.active !== undefined) u.active = patch.active;
    if (patch.password) u.passwordHash = await bcrypt.hash(patch.password, 12);
    const saved = await this.r.save(u);
    return { id: saved.id, username: saved.username, role: saved.role, ownerName: saved.ownerName, active: saved.active };
  }

  async remove(actorRole: Role, id: number) {
    if (actorRole !== 'admin') throw new ForbiddenException('Requires admin');
    const u = await this.r.findOne({ where: { id } });
    if (!u) throw new NotFoundException();
    await this.r.remove(u);
    return { ok: true };
  }
}
