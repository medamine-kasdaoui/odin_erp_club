import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Player } from './player.entity';

export enum HistoryEventType {
    STATUS_CHANGE = 'status_change',
    TEAM_CHANGE = 'team_change',
    INJURY = 'injury',
    SUSPENSION = 'suspension',
    CONTRACT_RENEWAL = 'contract_renewal',
    PROFILE_UPDATE = 'profile_update',
    TRANSFER = 'transfer',
}

@Entity('player_history')
export class PlayerHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'player_id' })
    playerId: string;

    @ManyToOne(() => Player)
    @JoinColumn({ name: 'player_id' })
    player: Player;

    @Column({
        name: 'event_type',
        type: 'enum',
        enum: HistoryEventType,
    })
    eventType: HistoryEventType;

    @Column({ name: 'event_date', type: 'date' })
    eventDate: Date;

    @Column({ nullable: true, type: 'text' })
    description: string;

    @Column({ name: 'previous_value', type: 'json', nullable: true })
    previousValue: Record<string, any>;

    @Column({ name: 'new_value', type: 'json', nullable: true })
    newValue: Record<string, any>;

    @Column({ name: 'created_by', nullable: true })
    createdBy: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
