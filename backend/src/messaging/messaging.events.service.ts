import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

const userRoom = (userId: string) => `user:${userId}`;
const clubRoom = (clubId: string) => `club:${clubId}`;
const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;

@Injectable()
export class MessagingEventsService {
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  hasServer(): boolean {
    return Boolean(this.server);
  }

  emitToConversation(conversationId: string, event: string, payload: Record<string, unknown>) {
    this.server?.to(conversationRoom(conversationId)).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: Record<string, unknown>) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: Record<string, unknown>) {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  emitToClub(clubId: string, event: string, payload: Record<string, unknown>) {
    this.server?.to(clubRoom(clubId)).emit(event, payload);
  }

  userRoom(userId: string): string {
    return userRoom(userId);
  }

  clubRoom(clubId: string): string {
    return clubRoom(clubId);
  }

  conversationRoom(conversationId: string): string {
    return conversationRoom(conversationId);
  }
}
