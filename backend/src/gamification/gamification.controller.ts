import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { AddActionDto } from './dto/add-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.gamificationService.getProfile(userId);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.gamificationService.getLeaderboard();
  }

  @Post('action')
  async addAction(@Body() dto: AddActionDto) {
    return this.gamificationService.addAction(dto);
  }
}
