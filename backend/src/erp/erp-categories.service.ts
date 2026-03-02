import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErpCategory, ErpCategoryDocument } from './schemas/erp-category.schema';

@Injectable()
export class ErpCategoriesService {
  constructor(
    @InjectModel(ErpCategory.name)
    private readonly categoryModel: Model<ErpCategoryDocument>
  ) {}

  async findAll(clubId: Types.ObjectId) {
    return this.categoryModel.find({ clubId }).sort({ name: 1 }).exec();
  }

  async findOne(id: string, clubId: Types.ObjectId) {
    const category = await this.categoryModel.findOne({ _id: id, clubId }).exec();
    if (!category) throw new NotFoundException('Catégorie introuvable');
    return category;
  }

  async create(clubId: Types.ObjectId, payload: Record<string, unknown>) {
    const category = new this.categoryModel({
      ...payload,
      clubId,
    });
    return category.save();
  }

  async remove(id: string, clubId: Types.ObjectId) {
    const category = await this.findOne(id, clubId);
    await category.deleteOne();
    return { success: true, message: 'Catégorie supprimée avec succès' };
  }
}
