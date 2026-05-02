import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConvocationDetailsDto {
    @IsOptional()
    @IsString()
    meetingTime?: string;       // ex: '09:00'

    @IsOptional()
    @IsString()
    requiredKit?: string;       // ex: 'Maillot domicile'

    @IsOptional()
    @IsString()
    instructions?: string;
}

export class SendConvocationsDto {
    /** Liste des participantIds à convoquer */
    @IsArray()
    @IsNotEmpty()
    playerIds: string[];

    @IsOptional()
    @ValidateNested()
    @Type(() => ConvocationDetailsDto)
    details?: ConvocationDetailsDto;
}
