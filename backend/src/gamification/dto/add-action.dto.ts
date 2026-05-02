import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class AddActionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  actionType: string;

  @IsNumber()
  @IsNotEmpty()
  points: number;

  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @IsString()
  @IsOptional()
  description?: string;
}
