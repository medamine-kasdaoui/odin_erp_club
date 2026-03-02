import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    findAll(@Request() req) {
        return this.usersService.findAll(req.user.clubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.usersService.findOne(id, req.user.clubId);
    }
}
