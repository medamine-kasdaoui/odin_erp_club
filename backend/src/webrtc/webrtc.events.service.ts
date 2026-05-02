import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

const userRoom = (userId: string) => `user:${userId}`;
const clubRoom = (clubId: string) => `club:${clubId}`;

@Injectable()
export class WebrtcEventsService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  hasServer() {
    return this.server !== null;
  }

  userRoom(userId: string) {
    return userRoom(userId);
  }

  clubRoom(clubId: string) {
    return clubRoom(clubId);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of new Set(userIds)) {
      this.emitToUser(userId, event, payload);
    }
  }

  emitToClub(clubId: string, event: string, payload: unknown) {
    this.server?.to(clubRoom(clubId)).emit(event, payload);
  }
}
