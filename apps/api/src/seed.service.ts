import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Role } from './auth/user.entity';

interface SeedUser { username: string; password: string; role: Role; ownerName: string; }
const USERS: SeedUser[] = [
  { username: 'admin', password: 'admin123', role: 'admin', ownerName: 'Admin' },
  { username: 'operator', password: 'operator123', role: 'operator', ownerName: 'Ops Team' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', ownerName: 'Read Only' },
];

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private u: Repository<User>,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA !== 'true') return;
    for (const def of USERS) {
      if (!(await this.u.findOne({ where: { username: def.username } }))) {
        await this.u.save(this.u.create({ username: def.username, passwordHash: await bcrypt.hash(def.password, 12), role: def.role, ownerName: def.ownerName, active: true }));
      }
    }
  }
}
