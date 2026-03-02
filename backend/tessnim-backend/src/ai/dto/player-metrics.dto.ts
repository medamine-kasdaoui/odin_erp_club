import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class PlayerMetricsDto {
    @IsString()
    playerId: string;

    @IsString()
    playerName: string;

    @IsString()
    position: string;

    @IsOptional()
    @IsString()
    matchDate?: string;

    // Training Load
    @IsOptional()
    @IsNumber()
    acwr?: number; // Acute:Chronic Workload Ratio (ideal: 0.8–1.3)

    @IsOptional()
    @IsNumber()
    trainingLoadKm?: number;

    // Biometrics
    @IsOptional()
    @IsNumber()
    @Min(0) @Max(100)
    hrvScore?: number; // Heart Rate Variability 0-100

    @IsOptional()
    @IsNumber()
    sleepHours?: number;

    @IsOptional()
    @IsNumber()
    @Min(0) @Max(100)
    sleepQuality?: number; // %

    // Physical state
    @IsOptional()
    @IsNumber()
    @Min(0) @Max(10)
    muscularPainLevel?: number;

    @IsOptional()
    @IsNumber()
    @Min(0) @Max(10)
    fatigueLevel?: number;

    // Medical
    @IsOptional()
    @IsString()
    injuryHistory?: string;

    @IsOptional()
    @IsString()
    activeInjuryZones?: string;

    @IsOptional()
    @IsNumber()
    daysSinceLastInjury?: number;

    // Recent form
    @IsOptional()
    @IsNumber()
    lastMatchRating?: number; // 0-10

    @IsOptional()
    @IsNumber()
    goalsLast5?: number;

    @IsOptional()
    @IsNumber()
    minutesLast5?: number;

    @IsOptional()
    @IsNumber()
    playerStatus?: string; // active, injured, suspended

    @IsOptional()
    @IsNumber()
    daysToMatch?: number;
}

export class SquadMetricsDto {
    @IsString()
    matchDate: string;

    players: PlayerMetricsDto[];
}
