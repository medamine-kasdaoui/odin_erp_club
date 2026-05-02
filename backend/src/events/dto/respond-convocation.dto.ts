import { IsEnum, IsNotEmpty } from 'class-validator';
import { ParticipationStatus } from '../schemas/event-participant.schema';

export class RespondConvocationDto {
    @IsEnum(ParticipationStatus)
    @IsNotEmpty()
    status: ParticipationStatus.CONFIRMED | ParticipationStatus.DECLINED;
}
