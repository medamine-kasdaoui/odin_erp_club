import { IsOptional, IsString, IsEnum, IsEmail, IsNumber, IsDateString } from 'class-validator';
import { StaffRole, StaffStatus } from '../entities/staff-member.entity';

export class UpdateStaffDto {
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsEnum(StaffRole)
    role?: StaffRole;

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
