import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LocationService } from './location.service';

@Module({
    imports: [HttpModule, ConfigModule],
    providers: [LocationService],
    exports: [LocationService],
})
export class LocationModule {}
