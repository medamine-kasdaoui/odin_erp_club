import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateTeamDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    clubId: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
