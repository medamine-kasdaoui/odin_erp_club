import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getProfile(@Request() req) {
        return this.authService.getProfile(req.user.userId, req.user.clubId);
    }

    @Get('pending-users')
    @UseGuards(JwtAuthGuard)
    getPendingUsers(@Request() req) {
        return this.authService.getPendingUsers(req.user.clubId);
    }

    @Post('approve/:userId')
    @UseGuards(JwtAuthGuard)
    approveUser(
        @Param('userId') userId: string,
        @Request() req,
    ) {
        return this.authService.approveUser(userId, req.user.userId, req.user.clubId);
    }

    @Post('reject/:userId')
    @UseGuards(JwtAuthGuard)
    rejectUser(
        @Param('userId') userId: string,
        @Request() req,
        @Body() approveDto: ApproveUserDto,
    ) {
        return this.authService.rejectUser(
            userId,
            req.user.userId,
            req.user.clubId,
            approveDto.reason,
        );
    }
}
