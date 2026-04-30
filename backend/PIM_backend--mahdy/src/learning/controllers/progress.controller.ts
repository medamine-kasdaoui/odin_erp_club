import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import { LearningService } from '../services/learning.service';

@ApiTags('learning-progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly learningService: LearningService) {}

  @Post('update')
  updateProgress(@Body() dto: UpdateProgressDto): Promise<any> {
    return this.learningService.updateProgress(dto);
  }

  @Get('player/:id')
  getPlayerProgress(@Param('id') id: string): Promise<any> {
    return this.learningService.getPlayerProgress(id);
  }
}
