import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('readiness_results')
export class ReadinessResult {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ name: 'player_id' })
    playerId: string;

    @Column({ name: 'player_name', length: 200 })
    playerName: string;

    @Index()
    @Column({ name: 'club_id' })
    clubId: string;

    @Column({ name: 'match_date', length: 20 })
    matchDate: string;

    @Column({ type: 'int' })
    score: number; // 0-100

    @Column({ length: 20 })
    status: string; // optimal|bon|attention|risque

    @Column({ name: 'titulaire', default: false })
    titulaire: boolean;

    @Column({ type: 'json', nullable: true })
    factors: any[];

    @Column({ type: 'text', nullable: true })
    analysis: string;

    @Column({ type: 'text', nullable: true })
    recommendation: string;

    @Column({ name: 'used_ai', default: false })
    usedAi: boolean; // true = Gemini, false = fallback formula

    @CreateDateColumn({ name: 'analyzed_at' })
    analyzedAt: Date;
}
