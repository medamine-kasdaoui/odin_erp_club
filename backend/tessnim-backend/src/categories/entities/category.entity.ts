import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Club } from '../../clubs/entities/club.entity';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'club_id' })
    clubId: string;

    @ManyToOne(() => Club)
    @JoinColumn({ name: 'club_id' })
    club: Club;

    @Column({ length: 50 })
    name: string; // U15, U17, U19, Seniors, etc.

    @Column({ name: 'age_min', nullable: true })
    ageMin: number;

    @Column({ name: 'age_max', nullable: true })
    ageMax: number;

    @Column({ nullable: true, type: 'text' })
    description: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
