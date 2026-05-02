import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubmitQuizDto } from '../dto/submit-quiz.dto';
import { LearningService } from '../services/learning.service';

@ApiTags('learning-quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly learningService: LearningService) {}

  @Get('lesson/:lessonId')
  getQuizForLesson(@Param('lessonId') lessonId: string): Promise<any[]> {
    return this.learningService.getQuizForLesson(lessonId);
  }

  @Post('submit')
  submitQuiz(@Body() dto: SubmitQuizDto): Promise<any> {
    return this.learningService.submitQuiz(dto);
  }
}
