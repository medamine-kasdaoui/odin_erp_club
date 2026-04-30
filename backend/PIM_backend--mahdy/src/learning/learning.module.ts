import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedicalModule } from '../medical/medical.module';
import { PlayersModule } from '../players/players.module';
import { CoursesController } from './controllers/courses.controller';
import { LearningController } from './controllers/learning.controller';
import { ProgressController } from './controllers/progress.controller';
import { QuizController } from './controllers/quiz.controller';
import { Course, CourseSchema } from './schemas/course.schema';
import { LearningExercise, LearningExerciseSchema } from './schemas/exercise.schema';
import { LearningImage, LearningImageSchema } from './schemas/learning-image.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { Progress, ProgressSchema } from './schemas/progress.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { LearningAiService } from './services/learning-ai.service';
import { LearningService } from './services/learning.service';

@Module({
  imports: [
    HttpModule,
    PlayersModule,
    MedicalModule,
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: LearningExercise.name, schema: LearningExerciseSchema },
      { name: LearningImage.name, schema: LearningImageSchema },
    ]),
  ],
  controllers: [
    CoursesController,
    ProgressController,
    QuizController,
    LearningController,
  ],
  providers: [LearningService, LearningAiService],
  exports: [LearningService, LearningAiService],
})
export class LearningModule {}
