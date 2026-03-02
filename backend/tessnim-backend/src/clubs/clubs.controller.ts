import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ClubsService } from './clubs.service';

@Controller('clubs')
export class ClubsController {
    constructor(private readonly clubsService: ClubsService) { }

    @Get()
    findAll() {
        return this.clubsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.clubsService.findOne(id);
    }

    @Post()
    create(@Body() body: any) {
        return this.clubsService.create(body);
    }
}
