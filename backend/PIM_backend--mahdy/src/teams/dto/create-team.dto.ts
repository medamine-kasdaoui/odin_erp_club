import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateTeamDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    clubId: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
