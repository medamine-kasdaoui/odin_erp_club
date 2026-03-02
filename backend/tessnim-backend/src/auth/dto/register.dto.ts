import {
    IsEmail,
    IsNotEmpty,
    IsString,
    IsEnum,
    IsUUID,
    IsOptional,
} from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsEnum(UserRole)
    role: UserRole;

    @IsUUID()
    @IsNotEmpty()
    clubId: string;
}
