import { IsString, IsNumber, IsOptional, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ReactionDto {
    @IsNumber() @IsNotEmpty() avgMs: number;
    @IsNumber() @IsNotEmpty() bestMs: number;
    @IsNumber() @IsNotEmpty() worstMs: number;
    @IsNumber() @IsNotEmpty() accuracy: number;
}

class FocusDto {
    @IsNumber() @IsNotEmpty() completionTime: number;
    @IsNumber() @IsNotEmpty() errors: number;
}

class MemoryDto {
    @IsNumber() @IsNotEmpty() correctSequences: number;
    @IsNumber() @IsNotEmpty() failures: number;
    @IsNumber() @IsNotEmpty() maxLevel: number;
}

class DecisionDto {
    @IsNumber() @IsOptional() avgDecisionTime?: number;
    @IsNumber() @IsOptional() correctAnswers?: number;
    @IsNumber() @IsOptional() wrongAnswers?: number;
    @IsNumber() @IsOptional() hesitationCount?: number;
    @IsNumber() @IsOptional() accuracy?: number;
}

class WellnessDto {
    @IsString() @IsOptional() sleepQuality?: string;
    @IsNumber() @IsOptional() sleepHours?: number;
    @IsString() @IsOptional() muscleSoreness?: string;
    @IsString() @IsOptional() stressLevel?: string;
    @IsString() @IsOptional() energyLevel?: string;
    @IsString() @IsOptional() mood?: string;
    @IsString() @IsOptional() motivation?: string;
    @IsNumber() @IsOptional() generalPain?: number;
}

export class CreateCognitiveSessionDto {
    @IsString()
    @IsNotEmpty()
    playerId: string;

    // Core tests
    @ValidateNested() @Type(() => ReactionDto) @IsNotEmpty()
    reaction: ReactionDto;

    @ValidateNested() @Type(() => FocusDto) @IsNotEmpty()
    focus: FocusDto;

    @ValidateNested() @Type(() => MemoryDto) @IsNotEmpty()
    memory: MemoryDto;

    // Extended tests (optional)
    @IsOptional() @ValidateNested() @Type(() => DecisionDto)
    decision?: DecisionDto;

    @IsOptional() @ValidateNested() @Type(() => WellnessDto)
    wellness?: WellnessDto;
}
