import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiReadinessService } from './ai-readiness.service';
import { AiReadinessController } from './ai-readiness.controller';
import { ReadinessResult } from './entities/readiness-result.entity';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([ReadinessResult]),
    ],
    controllers: [AiReadinessController],
    providers: [AiReadinessService],
    exports: [AiReadinessService],
})
export class AiModule { }
