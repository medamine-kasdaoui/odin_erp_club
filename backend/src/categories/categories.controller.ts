import {
    Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Get()
    findAll(@Request() req, @Query('clubId') clubId?: string) {
        const targetClubId = clubId || req.user.clubId;
        return this.categoriesService.findAll(targetClubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.categoriesService.findOne(id, req.user.clubId);
    }

    @Post()
    create(@Body() createCategoryDto: CreateCategoryDto, @Request() req) {
        if (!createCategoryDto.clubId) {
            createCategoryDto.clubId = req.user.clubId;
        }
        return this.categoriesService.create(createCategoryDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.categoriesService.remove(id, req.user.clubId);
    }
}
