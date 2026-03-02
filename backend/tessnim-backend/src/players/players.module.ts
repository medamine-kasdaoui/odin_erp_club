import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { Player } from './entities/player.entity';
import { PlayerHistory } from './entities/player-history.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Player, PlayerHistory])],
    controllers: [PlayersController],
    providers: [PlayersService],
    exports: [PlayersService],
})
export class PlayersModule { }
