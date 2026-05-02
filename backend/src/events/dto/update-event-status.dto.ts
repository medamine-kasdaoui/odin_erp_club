import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { EventStatus } from '../schemas/event.schema';

export class UpdateEventStatusDto {
    @IsNotEmpty()
    @IsEnum(EventStatus)
    status: EventStatus;

    @IsOptional()
    @IsString()
    reason?: string;
}

