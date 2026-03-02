import {
    IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean, IsNumber,
    IsDateString, IsObject, Min, IsInt,
} from 'class-validator';
import { EventType, EventVisibility } from '../entities/event.entity';

export class CreateEventDto {
    @IsNotEmpty()
    @IsEnum(EventType)
    eventType: EventType;

    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsDateString()
    startDate: string;

    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsBoolean()
    allDay?: boolean;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsObject()
    eventDetails?: Record<string, any>;

    @IsOptional()
    @IsEnum(EventVisibility)
    visibility?: EventVisibility;

    @IsOptional()
    @IsString()
    teamId?: string;

    @IsOptional()
    @IsString()
    clubId?: string; // Auto-filled from JWT

    @IsOptional()
    @IsBoolean()
    reminderEnabled?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    reminderMinutes?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    homeScore?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    awayScore?: number;
}
