import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Club } from '../../clubs/entities/club.entity';
import { Team } from '../../teams/entities/team.entity';
import { User } from '../../users/entities/user.entity';

export enum EventType {
    MATCH = 'match',
    DETECTION = 'detection',
    PHYSICAL_TEST = 'test_physique',
    TRAINING = 'entrainement',
    MEETING = 'reunion',
    OTHER = 'autre',
}

export enum EventStatus {
    SCHEDULED = 'scheduled',
    ONGOING = 'ongoing',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export enum EventVisibility {
    CLUB = 'club',
    TEAM = 'team',
    STAFF = 'staff',
    PUBLIC = 'public',
}

@Entity('events')
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'club_id' })
    clubId: string;

    @ManyToOne(() => Club)
    @JoinColumn({ name: 'club_id' })
    club: Club;

    // ─── Type & content ────────────────────────────────────────────
    @Column({
        name: 'event_type',
        type: 'enum',
        enum: EventType,
    })
    eventType: EventType;

    @Column({ length: 200 })
    title: string;

    @Column({ nullable: true, type: 'text' })
    description: string;

    // ─── Dates ─────────────────────────────────────────────────────
    @Column({ name: 'start_date', type: 'datetime' })
    startDate: Date;

    @Column({ name: 'end_date', type: 'datetime' })
    endDate: Date;

    @Column({ name: 'all_day', default: false })
    allDay: boolean;

    // ─── Location ──────────────────────────────────────────────────
    @Column({ nullable: true, length: 255 })
    location: string;

    // ─── Extra details (flexible JSON per event type) ──────────────
    @Column({ name: 'event_details', type: 'json', nullable: true })
    eventDetails: Record<string, any>;

    // ─── Status ────────────────────────────────────────────────────
    @Column({
        type: 'enum',
        enum: EventStatus,
        default: EventStatus.SCHEDULED,
    })
    status: EventStatus;

    // ─── Match Results ─────────────────────────────────────────────
    @Column({ name: 'home_score', type: 'int', nullable: true })
    homeScore: number;

    @Column({ name: 'away_score', type: 'int', nullable: true })
    awayScore: number;

    // ─── Scope ─────────────────────────────────────────────────────
    @Column({
        type: 'enum',
        enum: EventVisibility,
        default: EventVisibility.CLUB,
    })
    visibility: EventVisibility;

    @Column({ name: 'team_id', nullable: true })
    teamId: string;

    @ManyToOne(() => Team, { nullable: true, eager: true })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    // ─── Reminders ─────────────────────────────────────────────────
    @Column({ name: 'reminder_enabled', default: true })
    reminderEnabled: boolean;

    @Column({ name: 'reminder_minutes', default: 60 })
    reminderMinutes: number; // Minutes before event

    // ─── Metadata ──────────────────────────────────────────────────
    @Column({ name: 'created_by', nullable: true })
    createdBy: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
