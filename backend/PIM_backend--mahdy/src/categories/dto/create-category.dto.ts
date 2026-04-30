import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateCategoryDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    clubId: string;

    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(50)
    ageMin?: number;

    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(50)
    ageMax?: number;

    @IsOptional()
    @IsString()
    description?: string;
}
