import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTeamDto {
    @IsNotEmpty()
    @IsString()
    teamId: string;
}
