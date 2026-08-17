import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { StarlinkClient } from './starlink.client';

@Module({
  providers: [TokenService, StarlinkClient],
  exports: [TokenService, StarlinkClient],
})
export class StarlinkModule {}
