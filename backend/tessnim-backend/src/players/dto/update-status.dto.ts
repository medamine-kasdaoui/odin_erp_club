import { IsNotEmpty, IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { PlayerStatus } from '../entities/player.entity';

export class UpdateStatusDto {
    @IsNotEmpty()
    @IsEnum(PlayerStatus)
    status: PlayerStatus;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsDateString()
    returnDate?: string; // Expected return date for injured/suspended
}
