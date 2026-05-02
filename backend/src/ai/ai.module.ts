import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PythonProcessService } from './python-process.service';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { MedicalRecord, MedicalRecordSchema } from '../medical/schemas/medical-record.schema';
import { MatchPlayer, MatchPlayerSchema } from '../matches/schemas/match-player.schema';
import { LedgerEntry, LedgerEntrySchema } from '../finance/schemas/ledger-entry.schema';
import { Test, TestSchema } from './schemas/test.schema';

@Module({
    imports: [
        ConfigModule,
        HttpModule.register({
            timeout: 60000,
            maxRedirects: 5,
        }),
        MongooseModule.forFeature([
            { name: Player.name, schema: PlayerSchema },
            { name: MedicalRecord.name, schema: MedicalRecordSchema },
            { name: MatchPlayer.name, schema: MatchPlayerSchema },
            { name: LedgerEntry.name, schema: LedgerEntrySchema },
            { name: Test.name, schema: TestSchema },
        ]),
    ],
    controllers: [AiController],
    providers: [AiService, PythonProcessService],
    exports: [AiService, PythonProcessService],
})
export class AiModule { }
