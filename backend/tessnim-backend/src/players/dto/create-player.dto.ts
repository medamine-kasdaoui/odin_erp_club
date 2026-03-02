import {
    IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsDateString,
    Min, Max, IsBoolean, IsObject
} from 'class-validator';
import { PlayerPosition, PreferredFoot } from '../entities/player.entity';

export class CreatePlayerDto {
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @IsNotEmpty()
    @IsString()
    lastName: string;

    @IsNotEmpty()
    @IsDateString()
    dateOfBirth: string;

    @IsNotEmpty()
    @IsEnum(PlayerPosition)
    position: PlayerPosition;

    @IsOptional()
    @IsString()
    clubId?: string; // Auto-filled from JWT if not provided

    @IsOptional()
    @IsString()
    nationality?: string;

    @IsOptional()
    @IsString()
    photoUrl?: string;

    @IsOptional()
    @IsEnum(PreferredFoot)
    preferredFoot?: PreferredFoot;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(99)
    jerseyNumber?: number;

    @IsOptional()
    @IsNumber()
    height?: number;

    @IsOptional()
    @IsNumber()
    weight?: number;

    @IsOptional()
    @IsString()
    teamId?: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsDateString()
    contractStartDate?: string;

    @IsOptional()
    @IsDateString()
    contractEndDate?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    aiScore?: number;

    @IsOptional()
    @IsObject()
    stats?: any;

    @IsOptional()
    @IsBoolean()
    isProspect?: boolean;

    @IsOptional()
    @IsNumber()
    salary?: number;

    @IsOptional()
    @IsString()
    medicalNotes?: string;
}
