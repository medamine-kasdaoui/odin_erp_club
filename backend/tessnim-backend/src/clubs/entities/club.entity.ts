import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum ClubStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

export enum SubscriptionPlan {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise',
}

@Entity('clubs')
export class Club {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ name: 'logo_url', nullable: true })
    logoUrl: string;

    @Column({ nullable: true, length: 3 })
    country: string;

    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true, type: 'text' })
    address: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true })
    website: string;

    @Column({
        type: 'enum',
        enum: ClubStatus,
        default: ClubStatus.PENDING,
    })
    status: ClubStatus;

    @Column({ name: 'validated_by', nullable: true })
    validatedBy: string;

    @Column({ name: 'validated_at', type: 'timestamp', nullable: true })
    validatedAt: Date;

    @Column({
        type: 'enum',
        enum: SubscriptionPlan,
        name: 'subscription_plan',
        nullable: true,
    })
    subscriptionPlan: SubscriptionPlan;

    @Column({ name: 'subscription_start', type: 'date', nullable: true })
    subscriptionStart: Date;

    @Column({ name: 'subscription_end', type: 'date', nullable: true })
    subscriptionEnd: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
