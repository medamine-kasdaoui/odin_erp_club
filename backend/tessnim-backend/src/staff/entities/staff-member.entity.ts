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

export enum StaffRole {
    HEAD_COACH = 'Entraîneur principal',
    ASSISTANT_COACH = 'Entraîneur adjoint',
    GOALKEEPER_COACH = 'Entraîneur des gardiens',
    FITNESS_COACH = 'Préparateur physique',
    DOCTOR = 'Médecin',
    PHYSIOTHERAPIST = 'Kinésithérapeute',
    NUTRITIONIST = 'Nutritionniste',
    ANALYST = 'Analyste vidéo',
    SCOUT = 'Recruteur',
    MANAGER = 'Manager',
    OTHER = 'Autre',
}

export enum StaffStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    SUSPENDED = 'suspended',
}

@Entity('staff_members')
export class StaffMember {
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

    @Column({ name: 'date_of_birth', type: 'date', nullable: true })
    dateOfBirth: Date;

    @Column({ nullable: true, length: 3 })
    nationality: string;

    @Column({ name: 'photo_url', nullable: true, type: 'text' })
    photoUrl: string;

    @Column({ nullable: true, unique: true })
    email: string;

    @Column({ nullable: true, length: 20 })
    phone: string;

    // ─── Professional info ─────────────────────────────────────────
    @Column({
        type: 'enum',
        enum: StaffRole,
    })
    role: StaffRole;

    @Column({ nullable: true, length: 100 })
    specialization: string;

    @Column({ name: 'license_number', nullable: true, length: 50 })
    licenseNumber: string;

    // ─── Assignment ────────────────────────────────────────────────
    @Column({ name: 'team_id', nullable: true })
    teamId: string;

    @ManyToOne(() => Team, { nullable: true, eager: true })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    // ─── Contract ──────────────────────────────────────────────────
    @Column({ name: 'contract_start_date', type: 'date', nullable: true })
    contractStartDate: Date;

    @Column({ name: 'contract_end_date', type: 'date', nullable: true })
    contractEndDate: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    salary: number;

    // ─── Status ────────────────────────────────────────────────────
    @Column({
        type: 'enum',
        enum: StaffStatus,
        default: StaffStatus.ACTIVE,
    })
    status: StaffStatus;

    // ─── Metadata ──────────────────────────────────────────────────
    @Column({ name: 'created_by', nullable: true })
    createdBy: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
