import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength, IsOptional } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';
import { AccountsService } from './accounts.service';
import { StarlinkClient } from '../starlink/starlink.client';

class ApiAccountInput {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) clientId!: string;
  @IsString() @IsOptional() clientSecret?: string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private s: AccountsService, private starlink: StarlinkClient) {}

  @Get() @Roles('admin', 'operator', 'viewer')
  all() { return this.s.all(); }

  @Post() @Roles('admin')
  save(@Body() d: ApiAccountInput) { return this.s.save(d); }

  @Patch(':id') @Roles('admin')
  update(@Param('id') id: string, @Body() d: ApiAccountInput) {
    return this.s.save({ ...d, id: +id });
  }

  @Delete(':id') @Roles('admin')
  remove(@Param('id') id: string) { return this.s.remove(+id); }

  @Post(':id/test-connection') @Roles('admin')
  async testConnection(@Param('id') id: string) {
    const acc = await this.s.credentials(+id);
    const account = await this.starlink.getAccount({ clientId: acc.clientId, clientSecret: acc.clientSecret });
    return { ok: true, ...account };
  }

  @Post(':id/discover') @Roles('admin')
  async discover(@Param('id') id: string) {
    const acc = await this.s.credentials(+id);
    const creds = { clientId: acc.clientId, clientSecret: acc.clientSecret };
    const [serviceLines, terminals] = await Promise.all([
      this.starlink.getServiceLines(creds).catch((e: any) => {
        throw new Error(`Could not list service lines: ${e?.message || e}`);
      }),
      this.starlink.getUserTerminals(creds).catch(() => [] as any[]),
    ]);
    return {
      ok: true,
      serviceLines: serviceLines.map((sl) => ({
        serviceLineNumber: sl.serviceLineNumber,
        nickname: sl.nickname,
        state: sl.state,
        active: sl.active,
        servicePlan: sl.servicePlan?.name,
        usageLimitGB: sl.servicePlan?.usageLimitGB,
      })),
      terminals: terminals.map((t) => ({
        userTerminalId: t.userTerminalId,
        serviceLineNumber: t.serviceLineNumber,
        nickname: t.nickname,
        state: t.state,
      })),
    };
  }

  /** Read-only live account summary for the monitoring UI. Billing endpoints can
   * require an additional Starlink permission, so they fail soft. */
  @Get(':id/overview') @Roles('admin', 'operator', 'viewer')
  async overview(@Param('id') id: string) {
    const acc = await this.s.credentials(+id);
    const creds = { clientId: acc.clientId, clientSecret: acc.clientSecret };
    const [account, serviceLines, terminals, balance, invoices, usageServiceLines, addresses, products, dataPools, dataPoolUsage] = await Promise.all([
      this.starlink.getAccount(creds),
      this.starlink.getServiceLines(creds),
      this.starlink.getUserTerminals(creds).catch(() => [] as any[]),
      this.starlink.getBillingBalance(creds).catch(() => [] as any[]),
      this.starlink.getInvoices(creds).catch(() => [] as any[]),
      this.starlink.queryDataUsage(creds, { previousBillingCycles: 1 }).catch(() => [] as any[]),
      this.starlink.getAddresses(creds).catch(() => [] as any[]),
      this.starlink.getProducts(creds).catch(() => [] as any[]),
      this.starlink.getDataPools(creds).catch(() => [] as any[]),
      this.starlink.getDataPoolsUsage(creds).catch(() => null),
    ]);
    return {
      ok: true,
      account,
      serviceLines,
      terminals,
      serviceLineCount: serviceLines.length,
      terminalCount: terminals.length,
      balance,
      invoices: invoices.slice(0, 12),
      usageServiceLines,
      addresses,
      products,
      dataPools,
      dataPoolUsage,
      fetchedAt: new Date().toISOString(),
    };
  }
}
