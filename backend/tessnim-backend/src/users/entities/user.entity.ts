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

export enum UserRole {
    PLAYER = 'player',
    COACH = 'coach',
    MEDICAL_STAFF = 'medical_staff',
    TECHNICAL_STAFF = 'technical_staff',
    SCOUT = 'scout',
    ADMIN = 'admin',
    DIRECTOR = 'director',
    ADMIN_FINANCE = 'admin_finance',
    SUPER_ADMIN = 'super_admin',
}

export enum UserStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

export enum UserType {
    CANDIDATE = 'candidate',
    VALIDATED = 'validated',
    STAFF = 'staff',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ name: 'password_hash' })
    passwordHash: string;

    @Column({ name: 'first_name' })
    firstName: string;

    @Column({ name: 'last_name' })
    lastName: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ name: 'club_id' })
    clubId: string;

    @ManyToOne(() => Club)
    @JoinColumn({ name: 'club_id' })
    club: Club;

    @Column({
        type: 'enum',
        enum: UserRole,
    })
    role: UserRole;

    @Column({
        type: 'enum',
        enum: UserType,
        name: 'user_type',
    })
    userType: UserType;

    @Column({
        type: 'enum',
        enum: UserStatus,
        default: UserStatus.PENDING,
    })
    status: UserStatus;

    @Column({ name: 'approved_by', nullable: true })
    approvedBy: string;

    @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
    approvedAt: Date;

    @Column({ name: 'email_verified', default: false })
    emailVerified: boolean;

    @Column({ name: 'verification_token', nullable: true })
    verificationToken: string;

    @Column({ name: 'reset_password_token', nullable: true })
    resetPasswordToken: string;

    @Column({ name: 'reset_password_expires', type: 'timestamp', nullable: true })
    resetPasswordExpires: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'last_login', type: 'timestamp', nullable: true })
    lastLogin: Date;
}
