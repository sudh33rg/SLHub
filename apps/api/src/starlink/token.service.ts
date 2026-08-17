import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

export interface StarlinkCredentials {
  clientId: string;
  clientSecret: string;
}

interface TokenCache {
  token: string;
  /** epoch ms when the token was obtained */
  obtainedAt: number;
  /** epoch ms when the token expires; refetched before this */
  expiresAt: number;
}

/**
 * Per-account OAuth2 client-credentials token cache for the Starlink V2 API.
 *
 * V2 tokens are scoped to the Starlink *account* the service account belongs to,
 * so we keep one token per (clientId) credential set. Tokens live ~15 minutes;
 * we proactively refresh when within a 60s skew and also refresh on any 401.
 *
 * Authentication method: the V2 OpenID configuration advertises
 * `token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"]`.
 * V2 service accounts are registered with **client_secret_basic**, so the
 * client_id/client_secret MUST be sent in the `Authorization: Basic <base64>`
 * header. We send Basic first (the correct V2 method) and fall back to the
 * request body only if the token endpoint rejects Basic with `invalid_client`
 * (i.e. a server that only supports client_secret_post).
 */
@Injectable()
export class TokenService {
  private readonly log = new Logger(TokenService.name);
  private readonly auth: AxiosInstance;
  private readonly cache = new Map<string, TokenCache>();

  constructor() {
    this.auth = axios.create({
      baseURL: 'https://starlink.com/api/auth',
      timeout: 15000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** Base64-encoded `client_id:client_secret` for the HTTP Basic auth scheme. */
  private basicAuth(creds: StarlinkCredentials): string {
    return Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  }

  private async requestToken(creds: StarlinkCredentials, viaHeader: boolean): Promise<{ access_token: string; expires_in?: number }> {
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    // Always send form-urlencoded; add Basic auth header for client_secret_basic.
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(viaHeader ? { Authorization: `Basic ${this.basicAuth(creds)}` } : {}),
    };

    if (!viaHeader) {
      // client_secret_post: credentials in the body.
      body.set('client_id', creds.clientId);
      body.set('client_secret', creds.clientSecret);
    }

    const resp = await this.auth.post('/connect/token', body.toString(), { headers });
    return resp.data as { access_token: string; expires_in?: number; token_type?: string };
  }

  /** Returns a valid bearer token for the given credentials, reusing or refreshing the cache. */
  async getToken(creds: StarlinkCredentials): Promise<string> {
    const key = creds.clientId;
    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt - now > 60_000) return cached.token;

    let body: { access_token: string; expires_in?: number };
    try {
      // Primary: client_secret_basic (the V2 method that avoids `invalid_client`).
      body = await this.requestToken(creds, true);
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const errText = typeof data === 'string' ? data : JSON.stringify(data ?? '');
      // Fallback: some configurations accept credentials only in the POST body.
      if (status === 400 && /invalid_client/i.test(errText)) {
        this.log.warn(`Token endpoint rejected Basic auth (invalid_client); retrying with client_secret_post for ${key}`);
        body = await this.requestToken(creds, false);
      } else {
        throw e;
      }
    }

    const expiresIn = (body.expires_in ?? 900) * 1000;
    const token = body.access_token;
    this.cache.set(key, { token, obtainedAt: now, expiresAt: now + expiresIn });
    return token;
  }

  /** Forget a cached token (e.g. after a 401 or a failed request), forcing a refresh. */
  invalidate(clientId: string) {
    if (this.cache.delete(clientId)) this.log.debug(`Invalidated cached token for ${clientId}`);
  }
}
