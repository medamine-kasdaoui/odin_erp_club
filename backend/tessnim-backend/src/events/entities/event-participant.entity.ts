import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Event } from './event.entity';

export enum ParticipantType {
    PLAYER = 'player',
    STAFF = 'staff',
}

export enum ParticipationStatus {
    INVITED = 'invited',
    CONFIRMED = 'confirmed',
    DECLINED = 'declined',
    ABSENT = 'absent',
    PRESENT = 'present',
}

@Entity('event_participants')
@Unique(['eventId', 'participantType', 'participantId'])
export class EventParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'event_id' })
    eventId: string;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({
        name: 'participant_type',
        type: 'enum',
        enum: ParticipantType,
    })
    participantType: ParticipantType;

    @Column({ name: 'participant_id' })
    participantId: string; // player or staff UUID

    @Column({
        type: 'enum',
        enum: ParticipationStatus,
        default: ParticipationStatus.INVITED,
    })
    status: ParticipationStatus;

    @Column({ name: 'response_date', type: 'datetime', nullable: true })
    responseDate: Date;

    @Column({ nullable: true, type: 'text' })
    notes: string;

    @Column({ name: 'performance_rating', type: 'decimal', precision: 3, scale: 1, nullable: true })
    performanceRating: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
