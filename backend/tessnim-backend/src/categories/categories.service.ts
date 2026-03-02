import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectRepository(Category)
        private readonly categoryRepository: Repository<Category>,
    ) { }

    async findAll(clubId: string): Promise<Category[]> {
        return this.categoryRepository.find({
            where: { clubId },
            order: { name: 'ASC' },
        });
    }

    async findOne(id: string, clubId: string): Promise<Category> {
        const category = await this.categoryRepository.findOne({ where: { id, clubId } });
        if (!category) {
            throw new NotFoundException(`Catégorie #${id} introuvable ou accès refusé`);
        }
        return category;
    }

    async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
        const category = this.categoryRepository.create(createCategoryDto);
        return this.categoryRepository.save(category);
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const category = await this.findOne(id, clubId);
        await this.categoryRepository.remove(category);
        return { success: true, message: 'Catégorie supprimée avec succès' };
    }
}
