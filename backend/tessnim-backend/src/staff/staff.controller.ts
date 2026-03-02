import {
    Controller, Get, Post, Put, Delete, Body, Param, Query,
    UseGuards, Request,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
    constructor(private readonly staffService: StaffService) { }

    @Get()
    findAll(
        @Request() req,
        @Query('clubId') clubId?: string,
        @Query('role') role?: string,
        @Query('teamId') teamId?: string,
        @Query('status') status?: string,
    ) {
        const targetClubId = clubId || req.user.clubId;
        return this.staffService.findAll(targetClubId, { role, teamId, status });
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.staffService.findOne(id, req.user.clubId);
    }

    @Post()
    create(@Body() createStaffDto: CreateStaffDto, @Request() req) {
        if (!createStaffDto.clubId) {
            createStaffDto.clubId = req.user.clubId;
        }
        return this.staffService.create(createStaffDto, req.user.userId);
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() updateStaffDto: UpdateStaffDto,
        @Request() req,
    ) {
        return this.staffService.update(id, req.user.clubId, updateStaffDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.staffService.remove(id, req.user.clubId);
    }
}
