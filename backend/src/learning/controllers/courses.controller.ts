import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LearningService } from '../services/learning.service';

@ApiTags('learning-courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  getCourses(@Query('playerId') playerId?: string): Promise<any[]> {
    return this.learningService.getCourses(playerId);
  }

  @Get('recommended/player/:id')
  recommendCourses(@Param('id') id: string): Promise<any> {
    return this.learningService.recommendCourses(id);
  }

  @Get(':id/lessons')
  getCourseLessons(@Param('id') id: string): Promise<any> {
    return this.learningService.getCourseLessons(id);
  }
}
