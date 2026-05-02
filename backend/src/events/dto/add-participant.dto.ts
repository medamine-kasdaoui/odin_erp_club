import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ParticipantType } from '../schemas/event-participant.schema';

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

