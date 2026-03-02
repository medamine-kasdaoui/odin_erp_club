import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ParticipantType } from '../entities/event-participant.entity';

export class AddParticipantDto {
    @IsNotEmpty()
    @IsEnum(ParticipantType)
    participantType: ParticipantType;

    @IsNotEmpty()
    @IsString()
    participantId: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
