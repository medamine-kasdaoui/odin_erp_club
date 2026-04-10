import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiProcessService } from './ai-process.service';

@Module({
    imports: [
        ConfigModule,
        HttpModule.register({
            timeout: 60000, // 60s timeout for AI operations (training can be slow)
            maxRedirects: 5,
        }),
    ],
    controllers: [AiController],
    providers: [AiService, AiProcessService],
    exports: [AiService],
})
export class AiModule { }
