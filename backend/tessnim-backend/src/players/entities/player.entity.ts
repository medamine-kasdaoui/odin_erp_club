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
import { Category } from '../../categories/entities/category.entity';

export enum PlayerStatus {
    ACTIVE = 'active',
    INJURED = 'injured',
    SUSPENDED = 'suspended',
    INACTIVE = 'inactive',
}

export enum PlayerPosition {
    GOALKEEPER = 'Gardien',
    DEFENDER = 'Défenseur',
    MIDFIELDER = 'Milieu',
    FORWARD = 'Attaquant',
}

export enum PreferredFoot {
    LEFT = 'Gauche',
    RIGHT = 'Droit',
    BOTH = 'Les deux',
}

@Entity('players')
export class Player {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'club_id' })
    clubId: string;

    @ManyToOne(() => Club)
    @JoinColumn({ name: 'club_id' })
    club: Club;

    // ─── Personal info ─────────────────────────────────────────────
    @Column({ name: 'first_name', length: 100 })
    firstName: string;

    @Column({ name: 'last_name', length: 100 })
    lastName: string;

    @Column({ name: 'date_of_birth', type: 'date' })
    dateOfBirth: Date;

    @Column({ nullable: true, length: 3 })
    nationality: string; // ISO country code

    @Column({ name: 'photo_url', nullable: true, type: 'text' })
    photoUrl: string;

    // ─── Sport info ────────────────────────────────────────────────
    @Column({
        type: 'enum',
        enum: PlayerPosition,
    })
    position: PlayerPosition;

    @Column({
        name: 'preferred_foot',
        type: 'enum',
        enum: PreferredFoot,
        nullable: true,
    })
    preferredFoot: PreferredFoot;

    @Column({ name: 'jersey_number', nullable: true })
    jerseyNumber: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    height: number; // cm

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    weight: number; // kg

    // ─── Status ────────────────────────────────────────────────────
    @Column({
        type: 'enum',
        enum: PlayerStatus,
        default: PlayerStatus.ACTIVE,
    })
    status: PlayerStatus;

    @Column({ name: 'return_date', type: 'date', nullable: true })
    returnDate: Date; // For injured/suspended players

    // ─── Contract ──────────────────────────────────────────────────
    @Column({ name: 'contract_start_date', type: 'date', nullable: true })
    contractStartDate: Date;

    @Column({ name: 'contract_end_date', type: 'date', nullable: true })
    contractEndDate: Date;

    // ─── Assignment ────────────────────────────────────────────────
    @Column({ name: 'team_id', nullable: true })
    teamId: string;

    @ManyToOne(() => Team, { nullable: true, eager: true })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    @Column({ name: 'category_id', nullable: true })
    categoryId: string;

    @ManyToOne(() => Category, { nullable: true, eager: true })
    @JoinColumn({ name: 'category_id' })
    category: Category;

    // ─── Metadata ──────────────────────────────────────────────────
    @Column({ name: 'ai_score', type: 'int', nullable: true })
    aiScore: number;

    @Column({ type: 'json', nullable: true })
    stats: any;

    @Column({ name: 'is_prospect', default: false })
    isProspect: boolean;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    salary: number;

    @Column({ name: 'medical_notes', type: 'text', nullable: true })
    medicalNotes: string;

    @Column({ name: 'created_by', nullable: true })
    createdBy: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
