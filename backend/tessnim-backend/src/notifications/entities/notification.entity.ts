import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
    EVENT_REMINDER = 'event_reminder',
    NEW_EVENT = 'new_event',
    EVENT_CANCELLED = 'event_cancelled',
    EVENT_UPDATED = 'event_updated',
    STATUS_CHANGE = 'status_change',
    PARTICIPATION_REQUEST = 'participation_request',
    GENERAL = 'general',
}

export enum DeliveryStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // ─── Recipient ─────────────────────────────────────────────────
    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    // ─── Content ───────────────────────────────────────────────────
    @Column({ length: 200 })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({
        name: 'notification_type',
        type: 'enum',
        enum: NotificationType,
    })
    notificationType: NotificationType;

    // ─── Related entity ────────────────────────────────────────────
    @Column({ name: 'related_entity_type', nullable: true, length: 50 })
    relatedEntityType: string; // 'event', 'player', etc.

    @Column({ name: 'related_entity_id', nullable: true })
    relatedEntityId: string;

    // ─── Status ────────────────────────────────────────────────────
    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    @Column({ name: 'read_at', type: 'datetime', nullable: true })
    readAt: Date;

    // ─── Delivery ──────────────────────────────────────────────────
    @Column({
        name: 'delivery_status',
        type: 'enum',
        enum: DeliveryStatus,
        default: DeliveryStatus.PENDING,
    })
    deliveryStatus: DeliveryStatus;

    @Column({ name: 'fcm_token', nullable: true, type: 'text' })
    fcmToken: string; // Firebase Cloud Messaging token

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
