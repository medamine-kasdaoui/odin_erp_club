import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';

@Injectable()
export class MessagingRedisService {
  private readonly logger = new Logger(MessagingRedisService.name);
  private attached = false;

  constructor(private readonly configService: ConfigService) {}

  async attach(server: Server) {
    if (this.attached) {
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = Number(this.configService.get<string>('REDIS_PORT', '6379'));

    if (!redisUrl && !redisHost) {
      this.logger.log('Redis adapter skipped: no REDIS_URL/REDIS_HOST configured');
      return;
    }

    try {
      // Loaded dynamically so local development can still run without Redis packages.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAdapter } = require('@socket.io/redis-adapter');

      const pubClient = redisUrl
        ? new Redis(redisUrl)
        : new Redis({ host: redisHost, port: Number.isFinite(redisPort) ? redisPort : 6379 });
      const subClient = pubClient.duplicate();

      server.adapter(createAdapter(pubClient, subClient));
      this.attached = true;
      this.logger.log('Socket.IO Redis adapter attached successfully');
    } catch (error) {
      this.logger.warn(
        `Redis adapter unavailable (${error instanceof Error ? error.message : 'unknown error'})`
      );
    }
  }
}
