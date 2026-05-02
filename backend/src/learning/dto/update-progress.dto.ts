import { IsBoolean, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsMongoId()
  playerId: string;

  @IsMongoId()
  courseId: string;

  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
