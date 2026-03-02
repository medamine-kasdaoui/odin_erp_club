import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class ErpPlayerMetricsDto {
  @IsString()
  playerId: string;

  @IsString()
  playerName: string;

  @IsString()
  position: string;

  @IsOptional()
  @IsString()
  matchDate?: string;

  @IsOptional()
  @IsNumber()
  acwr?: number;

  @IsOptional()
  @IsNumber()
  trainingLoadKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  hrvScore?: number;

  @IsOptional()
  @IsNumber()
  sleepHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  sleepQuality?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  muscularPainLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  fatigueLevel?: number;

  @IsOptional()
  @IsString()
  injuryHistory?: string;

  @IsOptional()
  @IsString()
  activeInjuryZones?: string;

  @IsOptional()
  @IsNumber()
  daysSinceLastInjury?: number;

  @IsOptional()
  @IsNumber()
  lastMatchRating?: number;

  @IsOptional()
  @IsNumber()
  goalsLast5?: number;

  @IsOptional()
  @IsNumber()
  minutesLast5?: number;

  @IsOptional()
  @IsString()
  playerStatus?: string;

  @IsOptional()
  @IsNumber()
  daysToMatch?: number;
}

export class ErpSquadMetricsDto {
  @IsString()
  matchDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErpPlayerMetricsDto)
  players: ErpPlayerMetricsDto[];
}
