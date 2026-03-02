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
import { Category } from '../../categories/entities/category.entity';

@Entity('teams')
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'club_id' })
    clubId: string;

    @ManyToOne(() => Club)
    @JoinColumn({ name: 'club_id' })
    club: Club;

    @Column({ length: 100 })
    name: string;

    @Column({ name: 'category_id', nullable: true })
    categoryId: string;

    @ManyToOne(() => Category, { nullable: true, eager: true })
    @JoinColumn({ name: 'category_id' })
    category: Category;

    @Column({ nullable: true, type: 'text' })
    description: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
