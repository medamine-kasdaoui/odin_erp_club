import {
    Controller, Get, Patch, Delete, Param, Post, Body,
    UseGuards, Request, Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    /**
     * GET /api/v1/notifications
     * GET /api/v1/notifications?unreadOnly=true
     */
    @Get()
    findMine(@Request() req, @Query('unreadOnly') unreadOnly?: string) {
        return this.notificationsService.findMyNotifications(
            req.user.userId,
            unreadOnly === 'true',
        );
    }

    /**
     * PATCH /api/v1/notifications/:id/read
     */
    @Patch(':id/read')
    markAsRead(@Param('id') id: string, @Request() req) {
        return this.notificationsService.markAsRead(id, req.user.userId);
    }

    /**
     * PATCH /api/v1/notifications/read-all
     */
    @Patch('read-all')
    markAllAsRead(@Request() req) {
        return this.notificationsService.markAllAsRead(req.user.userId);
    }

    /**
     * DELETE /api/v1/notifications/:id
     */
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.notificationsService.remove(id, req.user.userId);
    }

    /**
     * POST /api/v1/notifications/register-token
     * Body: { fcmToken: "..." }
     */
    @Post('register-token')
    registerFcmToken(@Body('fcmToken') fcmToken: string, @Request() req) {
        return this.notificationsService.registerFcmToken(req.user.userId, fcmToken);
    }
}
