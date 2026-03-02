import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { EventStatus } from '../entities/event.entity';

export class UpdateEventStatusDto {
    @IsNotEmpty()
    @IsEnum(EventStatus)
    status: EventStatus;

    @IsOptional()
    @IsString()
    reason?: string;
}
