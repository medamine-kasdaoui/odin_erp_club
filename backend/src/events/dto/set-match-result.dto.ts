import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScorerDto {
    @IsString() playerId: string;
    @IsString() playerName: string;
    @IsNumber() minute: number;
    @IsOptional() isOwnGoal?: boolean;
}

export class AssistDto {
    @IsString() playerId: string;
    @IsString() playerName: string;
    @IsNumber() minute: number;
}

export class CardDto {
    @IsString() playerId: string;
    @IsString() playerName: string;
    @IsNumber() minute: number;
    @IsString() cardType: 'yellow' | 'red';
}

export class MatchStatsDto {
    @IsOptional() @IsNumber() @Min(0) possession?: number;
    @IsOptional() @IsNumber() @Min(0) shots?: number;
    @IsOptional() @IsNumber() @Min(0) shotsOnTarget?: number;
    @IsOptional() @IsNumber() @Min(0) corners?: number;
    @IsOptional() @IsNumber() @Min(0) fouls?: number;
}

export class SetMatchResultDto {
    @IsNumber()
    @Min(0)
    homeScore: number;

    @IsNumber()
    @Min(0)
    awayScore: number;

    @IsOptional()
    @IsString()
    opponentName?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ScorerDto)
    scorers?: ScorerDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AssistDto)
    assists?: AssistDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CardDto)
    cards?: CardDto[];

    @IsOptional()
    @ValidateNested()
    @Type(() => MatchStatsDto)
    stats?: MatchStatsDto;

    @IsOptional()
    @IsNumber()
    matchDuration?: number;

    @IsOptional()
    isHome?: boolean;
}
