import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ErpProxyController } from './erp-proxy.controller';
import { ErpProxyService } from './erp-proxy.service';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [ErpProxyController],
  providers: [ErpProxyService]
})
export class ErpProxyModule {}
