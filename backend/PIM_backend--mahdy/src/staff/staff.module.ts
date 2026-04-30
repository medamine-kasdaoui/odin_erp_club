import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoachesController } from './coaches.controller';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffMember, StaffMemberSchema } from './schemas/staff-member.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: StaffMember.name, schema: StaffMemberSchema }])],
  controllers: [StaffController, CoachesController],
  providers: [StaffService],
  exports: [StaffService]
})
export class StaffModule {}
