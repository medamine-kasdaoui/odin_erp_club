import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChatbotMessageDto } from '../dto/chatbot-message.dto';
import { LearningAiService } from '../services/learning-ai.service';
import { LearningService } from '../services/learning.service';

@ApiTags('learning')
@Controller('learning')
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly learningAiService: LearningAiService,
  ) {}

  @Get('dashboard/player/:id')
  getPlayerDashboard(@Param('id') id: string): Promise<any> {
    return this.learningService.getLearningDashboard(id);
  }

  @Get('lessons/:lessonId/exercises')
  getLessonExercises(@Param('lessonId') lessonId: string): Promise<any[]> {
    return this.learningService.getExercisesForLesson(lessonId);
  }

  @Get('exercises/:id')
  getExercise(@Param('id') id: string): Promise<any> {
    return this.learningService.getExercise(id);
  }

  @Get('pages/:pageNumber/images')
  getImagesByPage(@Param('pageNumber', ParseIntPipe) pageNumber: number): Promise<any[]> {
    return this.learningService.getImagesByPage(pageNumber);
  }

  @Post('chatbot')
  chatbot(@Body() dto: ChatbotMessageDto): Promise<any> {
    return this.learningAiService.practice(dto);
  }
}
