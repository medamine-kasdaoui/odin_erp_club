import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';

@Injectable()
export class WebrtcRedisService {
  private readonly logger = new Logger(WebrtcRedisService.name);
  private readonly attachedServers = new WeakSet<Server>();

  constructor(private readonly configService: ConfigService) {}

  async attach(server: Server) {
    if (this.attachedServers.has(server)) {
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = Number(this.configService.get<string>('REDIS_PORT', '6379'));

    if (!redisUrl && !redisHost) {
      this.logger.log('Redis adapter skipped for WebRTC: no REDIS_URL/REDIS_HOST configured');
      return;
    }

    try {
      // Loaded dynamically to keep local development lightweight.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAdapter } = require('@socket.io/redis-adapter');

      const pubClient = redisUrl
        ? new Redis(redisUrl)
        : new Redis({ host: redisHost, port: Number.isFinite(redisPort) ? redisPort : 6379 });
      const subClient = pubClient.duplicate();

      server.adapter(createAdapter(pubClient, subClient));
      this.attachedServers.add(server);
      this.logger.log('Socket.IO Redis adapter attached for WebRTC');
    } catch (error) {
      this.logger.warn(
        `WebRTC Redis adapter unavailable (${error instanceof Error ? error.message : 'unknown error'})`
      );
    }
  }
}
