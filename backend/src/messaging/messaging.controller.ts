import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/enums/permission.enum';
import { Role } from '../common/enums/role.enum';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateGroupConversationDto,
  CreatePrivateConversationDto,
  ListClubUsersDto,
  ListConversationsDto,
  ListMessagesDto,
  SendMessageDto
} from './dto/messaging.dto';
import { MessagingEventsService } from './messaging.events.service';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(
  Role.CLUB_RESPONSABLE,
  Role.FINANCIER,
  Role.JOUEUR,
  Role.STAFF_TECHNIQUE,
  Role.STAFF_MEDICAL,
  Role.SCOUT
)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingEvents: MessagingEventsService
  ) {}

  @Permissions(Permission.CHAT_READ)
  @Get('conversations/users')
  listUsers(
    @CurrentUser() actor: AuthUser,
    @Query() query: ListClubUsersDto
  ): Promise<unknown> {
    return this.messagingService.listClubUsers(actor, query);
  }

  @Permissions(Permission.CHAT_READ)
  @Get('conversations')
  listConversations(
    @CurrentUser() actor: AuthUser,
    @Query() query: ListConversationsDto
  ): Promise<unknown> {
    return this.messagingService.listConversations(actor, query);
  }

  @Permissions(Permission.CHAT_READ)
  @Get('messages/:conversationId')
  async listMessages(
    @CurrentUser() actor: AuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesDto
  ): Promise<unknown> {
    const result = await this.messagingService.listMessages(actor, conversationId, query);

    if (result.readCount > 0 && this.messagingEvents.hasServer()) {
      this.messagingEvents.emitToConversation(conversationId, 'message_read', {
        conversationId,
        userId: actor.sub,
        readCount: result.readCount,
        readAt: new Date().toISOString()
      });

      const summary = await this.messagingService.getConversationSummaryForActor(actor, conversationId);
      const participantUserIds = await this.messagingService.getConversationParticipantUserIdsForActor(
        actor,
        conversationId
      );

      this.messagingEvents.emitToUsers(participantUserIds, 'conversation_updated', {
        conversation: summary,
        updatedBy: actor.sub,
        updatedAt: new Date().toISOString()
      });
    }

    return result;
  }

  @Permissions(Permission.CHAT_WRITE)
  @Post('conversations/private')
  createPrivate(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreatePrivateConversationDto
  ): Promise<unknown> {
    return this.messagingService.createPrivateConversation(actor, dto);
  }

  @Permissions(Permission.CHAT_WRITE)
  @Post('conversations/group')
  createGroup(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateGroupConversationDto
  ): Promise<unknown> {
    return this.messagingService.createGroupConversation(actor, dto);
  }

  @Permissions(Permission.CHAT_WRITE)
  @Post('messages/:conversationId')
  async sendMessage(
    @CurrentUser() actor: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto
  ): Promise<unknown> {
    const sendResult = await this.messagingService.sendMessage(actor, conversationId, dto);

    this.messagingEvents.emitToConversation(sendResult.conversationId, 'new_message', {
      conversationId: sendResult.conversationId,
      message: sendResult.message
    });

    const summary = await this.messagingService.getConversationSummaryForActor(
      actor,
      sendResult.conversationId
    );

    this.messagingEvents.emitToUsers(sendResult.participantUserIds, 'conversation_updated', {
      conversation: summary,
      updatedBy: actor.sub,
      updatedAt: new Date().toISOString()
    });

    return sendResult.message;
  }
}
