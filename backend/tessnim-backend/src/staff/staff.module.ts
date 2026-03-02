import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffMember } from './entities/staff-member.entity';

@Module({
    imports: [TypeOrmModule.forFeature([StaffMember])],
    controllers: [StaffController],
    providers: [StaffService],
    exports: [StaffService],
})
export class StaffModule { }
