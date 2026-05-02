import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max, IsOptional } from 'class-validator';
import { BasePlayerFeaturesDto } from './base-player-features.dto';

export class PredictPlayerValueDto extends BasePlayerFeaturesDto {
    // Medical specific
    @ApiProperty({ example: 15, description: 'Average recovery time in days' })
    @IsNumber()
    @Min(0)
    recoveryTime: number;

    @ApiProperty({ example: 85, description: 'Current fitness level (0-100)' })
    @IsNumber()
    @Min(0)
    @Max(100)
    fitnessLevel: number;

    @ApiProperty({ example: 2.5, description: 'Medical risk score (lower is better)' })
    @IsNumber()
    @Min(0)
    medicalRiskScore: number;

    // Performance specific
    @ApiProperty({ example: 12, description: 'Total goals scored' })
    @IsNumber()
    @Min(0)
    goals: number;

    @ApiProperty({ example: 8, description: 'Total assists' })
    @IsNumber()
    @Min(0)
    assists: number;

    @ApiProperty({ example: 1850, description: 'Total minutes played' })
    @IsNumber()
    @Min(0)
    minutesPlayed: number;

    @ApiProperty({ example: 7.8, description: 'Average rating per match' })
    @IsNumber()
    @Min(0)
    @Max(10)
    ratingPerMatch: number;

    @ApiProperty({ example: 82, description: 'Consistency score (0-100)' })
    @IsNumber()
    @Min(0)
    @Max(100)
    consistencyScore: number;

    @ApiProperty({ required: false, example: 50000000, description: 'Initial acquisition cost if known' })
    @IsOptional()
    @IsNumber()
    acquisitionCost?: number;
}
