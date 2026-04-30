import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  findAll(
    @Query('role') role?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string
  ) {
    return this.staffService.findAll({ role, teamId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Post()
  create(@Body() payload: Record<string, unknown>) {
    return this.staffService.create(payload);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() payload: Record<string, unknown>) {
    return this.staffService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
