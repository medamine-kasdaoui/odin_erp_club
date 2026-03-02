import {
    IsOptional, IsString, IsEnum, IsBoolean, IsNumber, IsDateString, IsObject, Min, IsInt
} from 'class-validator';
import { EventType, EventStatus, EventVisibility } from '../entities/event.entity';

export class UpdateEventDto {
    @IsOptional()
    @IsEnum(EventType)
    eventType?: EventType;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

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
    @IsEnum(EventStatus)
    status?: EventStatus;

    @IsOptional()
    @IsEnum(EventVisibility)
    visibility?: EventVisibility;

    @IsOptional()
    @IsString()
    teamId?: string;

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
