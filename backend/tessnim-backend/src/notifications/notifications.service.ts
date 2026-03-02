import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, DeliveryStatus } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
    ) { }

    /**
     * Get all notifications for the current user (most recent first)
     */
    async findMyNotifications(userId: string, unreadOnly = false) {
        const query = this.notificationRepository.createQueryBuilder('notification')
            .where('notification.userId = :userId', { userId })
            .orderBy('notification.createdAt', 'DESC')
            .take(50);

        if (unreadOnly) {
            query.andWhere('notification.isRead = false');
        }

        const [notifications, total] = await query.getManyAndCount();
        const unreadCount = await this.notificationRepository.count({
            where: { userId, isRead: false },
        });

        return { success: true, data: { notifications, total, unreadCount } };
    }

    /**
     * Mark a single notification as read
     */
    async markAsRead(id: string, userId: string): Promise<Notification> {
        const notification = await this.notificationRepository.findOne({
            where: { id, userId },
        });
        if (!notification) throw new NotFoundException('Notification introuvable');

        notification.isRead = true;
        notification.readAt = new Date();
        return this.notificationRepository.save(notification);
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
        const result = await this.notificationRepository
            .createQueryBuilder()
            .update(Notification)
            .set({ isRead: true, readAt: new Date() })
            .where('userId = :userId AND isRead = false', { userId })
            .execute();

        return { success: true, count: result.affected || 0 };
    }

    /**
     * Delete a notification
     */
    async remove(id: string, userId: string): Promise<{ success: boolean; message: string }> {
        const notification = await this.notificationRepository.findOne({
            where: { id, userId },
        });
        if (!notification) throw new NotFoundException('Notification introuvable');
        await this.notificationRepository.remove(notification);
        return { success: true, message: 'Notification supprimée' };
    }

    /**
     * Register FCM token for push notifications
     * (Stub — real implementation requires Firebase Admin SDK)
     */
    async registerFcmToken(userId: string, fcmToken: string): Promise<{ success: boolean; message: string }> {
        // In a real implementation: persist the token per user device
        // and use Firebase Admin SDK to send push notifications
        return {
            success: true,
            message: `Token FCM enregistré pour l'utilisateur ${userId}. Intégration Firebase à compléter.`,
        };
    }
}
