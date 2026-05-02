import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { LiveEventType } from '../schemas/match-live-event.schema';

export class AddLiveEventDto {
    @IsEnum(LiveEventType)
    @IsNotEmpty()
    type: LiveEventType;

    @IsNumber()
    @Min(0)
    @Max(120)
    minute: number;

    @IsOptional()
    @IsString()
    playerId?: string;

    @IsOptional()
    @IsString()
    playerName?: string;

    @IsOptional()
    @IsString()
    playerInId?: string;

    @IsOptional()
    @IsString()
    playerInName?: string;

    @IsOptional()
    @IsString()
    assistPlayerId?: string;

    @IsOptional()
    @IsString()
    assistPlayerName?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
