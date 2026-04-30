import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectModel(Category.name)
        private readonly categoryModel: Model<CategoryDocument>,
    ) { }

    async findAll(clubId: string): Promise<Category[]> {
        return this.categoryModel.find({ clubId })
            .sort({ name: 1 })
            .populate('club')
            .exec();
    }

    async findOne(id: string, clubId: string): Promise<Category> {
        const category = await this.categoryModel.findOne({ _id: id, clubId })
            .populate('club')
            .exec();
        if (!category) {
            throw new NotFoundException(`Catégorie #${id} introuvable ou accès refusé`);
        }
        return category;
    }

    async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
        const category = new this.categoryModel(createCategoryDto);
        return category.save();
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const category = await this.categoryModel.findOneAndDelete({ _id: id, clubId }).exec();
        if (!category) {
            throw new NotFoundException(`Catégorie #${id} introuvable ou accès refusé`);
        }
        return { success: true, message: 'Catégorie supprimée avec succès' };
    }
}
