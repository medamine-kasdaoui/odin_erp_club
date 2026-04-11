import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { Player, PlayerSchema } from './schemas/player.schema';
import { EventPlayer, EventPlayerSchema } from '../sports-performance/event-players/entities/event-player.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Player.name, schema: PlayerSchema },
      { name: EventPlayer.name, schema: EventPlayerSchema }
    ])
  ],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService, MongooseModule]
})
export class PlayersModule {}
