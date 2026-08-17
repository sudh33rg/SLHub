import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private jwt: JwtService,
  ) {}

  private sign(u: User) {
    return {
      accessToken: this.jwt.sign({ sub: u.id, username: u.username, role: u.role }),
      user: { id: u.id, username: u.username, role: u.role, ownerName: u.ownerName },
    };
  }

  async login(username: string, password: string) {
    const u = await this.repo.findOne({ where: { username } });
    // SECURITY FIX: never auto-create users on failed login.
    if (!u || !u.active) throw new UnauthorizedException('Invalid username or password');
    if (!(await bcrypt.compare(password, u.passwordHash))) throw new UnauthorizedException('Invalid username or password');
    return this.sign(u);
  }

  async me(id: number) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException();
    return { id: u.id, username: u.username, role: u.role, ownerName: u.ownerName, active: u.active };
  }

  async changePassword(id: number, password: string) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException();
    u.passwordHash = await bcrypt.hash(password, 12);
    await this.repo.save(u);
    return { ok: true };
  }
}
