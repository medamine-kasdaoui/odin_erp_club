import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsNumber, IsDateString } from 'class-validator';
import { StaffRole, StaffStatus } from '../entities/staff-member.entity';

export class CreateStaffDto {
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @IsNotEmpty()
    @IsString()
    lastName: string;

    @IsNotEmpty()
    @IsEnum(StaffRole)
    role: StaffRole;

    @IsOptional()
    @IsString()
    clubId?: string;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @IsOptional()
    @IsString()
    nationality?: string;

    @IsOptional()
    @IsString()
    photoUrl?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    specialization?: string;

    @IsOptional()
    @IsString()
    licenseNumber?: string;

    @IsOptional()
    @IsString()
    teamId?: string;

    @IsOptional()
    @IsDateString()
    contractStartDate?: string;

    @IsOptional()
    @IsDateString()
    contractEndDate?: string;

    @IsOptional()
    @IsNumber()
    salary?: number;

    @IsOptional()
    @IsEnum(StaffStatus)
    status?: StaffStatus;
}
