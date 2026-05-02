import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class QuizAnswerDto {
  @IsMongoId()
  quizId: string;

  @IsString()
  answer: string;
}

export class SubmitQuizDto {
  @IsOptional()
  @IsMongoId()
  playerId?: string;

  @IsMongoId()
  lessonId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
