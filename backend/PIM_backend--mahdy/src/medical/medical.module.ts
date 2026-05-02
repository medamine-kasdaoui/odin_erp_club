import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MedicalController } from "./medical.controller";
import { MedicalVisionController } from "./medical-vision.controller";
import { MedicalService } from "./medical.service";
import { MedicalVisionService } from "./medical-vision.service";
import { PlayersModule } from "../players/players.module";
import { MedicalRecord, MedicalRecordSchema } from "./schemas/medical-record.schema";

@Module({
  imports: [
    PlayersModule,
    MongooseModule.forFeature([
      { name: MedicalRecord.name, schema: MedicalRecordSchema },
    ]),
  ],
  controllers: [MedicalController, MedicalVisionController],
  providers: [MedicalService, MedicalVisionService],
  exports: [MedicalService, MedicalVisionService],
})
export class MedicalModule {}