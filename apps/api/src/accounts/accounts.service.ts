import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ApiAccount } from './api-account.entity';
import { Site } from '../sites/site.entity';

export interface DecryptedAccount {
  id: number;
  name: string;
  clientId: string;
  clientSecret: string;
}

function encryptionKey(): Buffer {
  const configured = process.env.APP_ENCRYPTION_KEY;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new Error('APP_ENCRYPTION_KEY must be configured in production');
    return Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
  }
  if (/^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
  const key = Buffer.from(configured, 'utf8');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 UTF-8 bytes or 64 hexadecimal characters');
  return key;
}

const key = encryptionKey();

function enc(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
}

function dec(value: string) {
  const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(ApiAccount) private r: Repository<ApiAccount>,
    @InjectRepository(Site) private sites: Repository<Site>,
  ) {}

  async all() {
    const accounts = await this.r.find({ order: { name: 'ASC' } });
    return accounts.map((account) => this.publicAccount(account));
  }

  async save(data: any) {
    let account = data.id ? await this.r.findOne({ where: { id: +data.id } }) : undefined;
    if (data.id && !account) throw new NotFoundException();
    if (!account) account = this.r.create();

    account.name = data.name.trim();
    account.clientId = data.clientId.trim();
    // An edit may leave the secret blank so the existing encrypted value is preserved.
    if (data.clientSecret) account.clientSecretEncrypted = enc(data.clientSecret);
    if (!account.clientSecretEncrypted) throw new Error('Client secret is required when creating an API account');
    account.status = 'configured';
    return this.publicAccount(await this.r.save(account));
  }

  async remove(id: number) {
    const account = await this.r.findOne({ where: { id } });
    if (!account) throw new NotFoundException();
    const linkedSites = await this.sites.count({ where: { apiAccountId: id } });
    if (linkedSites > 0) throw new ConflictException(`API account is linked to ${linkedSites} site(s); unlink them before deleting it`);
    await this.r.remove(account);
    return { ok: true };
  }

  /** Decrypt and return the credentials needed to call the Starlink V2 API for this account. */
  async credentials(id: number): Promise<DecryptedAccount> {
    const account = await this.r.findOne({ where: { id } });
    if (!account) throw new NotFoundException();
    return {
      id: account.id,
      name: account.name,
      clientId: account.clientId,
      clientSecret: dec(account.clientSecretEncrypted),
    };
  }

  private publicAccount(account: ApiAccount) {
    return {
      id: account.id,
      name: account.name,
      clientId: account.clientId,
      status: account.status,
      secretConfigured: Boolean(account.clientSecretEncrypted),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
