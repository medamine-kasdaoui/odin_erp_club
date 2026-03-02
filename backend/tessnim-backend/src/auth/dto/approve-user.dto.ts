import { IsOptional, IsString } from 'class-validator';

export class ApproveUserDto {
    @IsOptional()
    @IsString()
    reason?: string;
}
