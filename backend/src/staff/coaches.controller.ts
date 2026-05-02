import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StaffService } from './staff.service';

@Controller('coaches')
export class CoachesController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  findAll(@Query('page') _page?: string, @Query('limit') _limit?: string) {
    return this.staffService.findAll({ role: 'coach' });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Post()
  create(@Body() payload: Record<string, unknown>) {
    return this.staffService.create({ ...payload, role: payload.role ?? 'coach' });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: Record<string, unknown>) {
    return this.staffService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
