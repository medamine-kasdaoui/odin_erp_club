import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { Team, TeamDocument } from '../teams/schemas/team.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreateGroupConversationDto,
  CreatePrivateConversationDto,
  ListClubUsersDto,
  ListConversationsDto,
  ListMessagesDto,
  SendMessageDto,
  SocketSendMessageDto
} from './dto/messaging.dto';
import { MessagingConversationType } from './enums/messaging-conversation-type.enum';
import { MessagingMessageType } from './enums/messaging-message-type.enum';
import {
  MessagingConversation,
  MessagingConversationDocument
} from './schemas/conversation.schema';
import { MessagingMessage, MessagingMessageDocument } from './schemas/message.schema';

export interface MessagingActorContext {
  userId: string;
  email: string;
  role: Role;
  clubId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
}

interface ConversationParticipantView {
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  teamId: string | null;
  photoUrl: string | null;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(MessagingConversation.name)
    private readonly conversationModel: Model<MessagingConversationDocument>,
    @InjectModel(MessagingMessage.name)
    private readonly messageModel: Model<MessagingMessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
    private readonly notificationsService: NotificationsService
  ) {}

  async resolveActorFromJwtPayload(payload: AuthUser): Promise<MessagingActorContext> {
    return this.resolveActorContext(payload);
  }

  async listClubUsers(actor: AuthUser, query: ListClubUsersDto) {
    const actorContext = await this.resolveActorContext(actor);
    const actorObjectId = new Types.ObjectId(actorContext.userId);
    const clubObjectId = new Types.ObjectId(actorContext.clubId);
    const limit = Math.min(Math.max(Number(query.limit ?? 60), 1), 200);

    const filter: FilterQuery<UserDocument> = {
      clubId: clubObjectId,
      status: UserStatus.ACTIVE,
      _id: { $ne: actorObjectId }
    };

    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex }
      ];
    }

    const rows = await this.userModel
      .find(filter)
      .select('_id firstName lastName email phone photoUrl role clubId teamId')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();

    return rows.map((row) => ({
      _id: String(row._id),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      role: row.role,
      clubId: row.clubId ? String(row.clubId) : null,
      teamId: row.teamId ? String(row.teamId) : null,
      photoUrl: row.photoUrl ?? null
    }));
  }

  async listConversations(actor: AuthUser, query: ListConversationsDto) {
    const actorContext = await this.resolveActorContext(actor);
    const actorObjectId = new Types.ObjectId(actorContext.userId);
    const clubObjectId = new Types.ObjectId(actorContext.clubId);

    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 100);

    const filter: FilterQuery<MessagingConversationDocument> = {
      clubId: clubObjectId,
      participants: actorObjectId
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ title: regex }, { 'lastMessage.content': regex }];
    }

    const rows = await this.conversationModel
      .find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const visibleRows = rows.filter((conversation) =>
      this.isConversationVisibleToActor(conversation, actorContext)
    );

    const participantIds = new Set<string>();
    for (const conversation of visibleRows) {
      for (const participantId of conversation.participants || []) {
        participantIds.add(String(participantId));
      }
    }

    const users = participantIds.size
      ? await this.userModel
          .find({
            _id: { $in: Array.from(participantIds).map((id) => new Types.ObjectId(id)) },
            clubId: clubObjectId
          })
          .select('_id firstName lastName role photoUrl teamId')
          .lean()
      : [];

    const userMap = new Map<string, UserDocument & { _id: Types.ObjectId }>();
    for (const user of users) {
      userMap.set(String(user._id), user as UserDocument & { _id: Types.ObjectId });
    }

    const items = await Promise.all(
      visibleRows.map(async (conversation) => {
        const unreadCount = await this.messageModel.countDocuments({
          clubId: clubObjectId,
          conversationId: conversation._id,
          senderId: { $ne: actorObjectId },
          readBy: { $ne: actorObjectId }
        });

        return this.toConversationView(conversation, actorContext, userMap, unreadCount);
      })
    );

    return {
      page,
      limit,
      items
    };
  }

  async createPrivateConversation(actor: AuthUser, dto: CreatePrivateConversationDto) {
    const actorContext = await this.resolveActorContext(actor);
    if (dto.targetUserId === actorContext.userId) {
      throw new BadRequestException('Cannot create a private conversation with yourself');
    }

    const clubObjectId = new Types.ObjectId(actorContext.clubId);
    const actorObjectId = new Types.ObjectId(actorContext.userId);
    const targetObjectId = this.toObjectId(dto.targetUserId, 'targetUserId');

    const targetUser = await this.userModel
      .findOne({ _id: targetObjectId, clubId: clubObjectId, status: UserStatus.ACTIVE })
      .select('_id');

    if (!targetUser) {
      throw new ForbiddenException('Target user is outside your club scope or inactive');
    }

    const participantKey = this.buildParticipantKey([actorContext.userId, dto.targetUserId]);

    let conversation = await this.conversationModel.findOne({
      clubId: clubObjectId,
      type: MessagingConversationType.PRIVATE,
      participantKey
    });

    if (!conversation) {
      try {
        conversation = await this.conversationModel.create({
          type: MessagingConversationType.PRIVATE,
          clubId: clubObjectId,
          teamId: null,
          participants: [actorObjectId, targetObjectId],
          participantKey,
          title: null,
          lastMessage: null,
          createdBy: actorObjectId
        });
      } catch (error) {
        conversation = await this.conversationModel.findOne({
          clubId: clubObjectId,
          type: MessagingConversationType.PRIVATE,
          participantKey
        });

        if (!conversation) {
          throw error;
        }
      }
    }

    return this.getConversationViewForActorById(actorContext, String(conversation._id));
  }

  async createGroupConversation(actor: AuthUser, dto: CreateGroupConversationDto) {
    const actorContext = await this.resolveActorContext(actor);
    const clubObjectId = new Types.ObjectId(actorContext.clubId);

    const uniqueIds = Array.from(new Set([...dto.participantIds, actorContext.userId]));
    const userObjectIds = uniqueIds.map((id) => this.toObjectId(id, 'participantId'));

    const users = await this.userModel
      .find({
        _id: { $in: userObjectIds },
        clubId: clubObjectId,
        status: UserStatus.ACTIVE
      })
      .select('_id teamId');

    if (users.length !== uniqueIds.length) {
      throw new ForbiddenException('Some participants are outside your club scope or inactive');
    }

    let normalizedTeamId: Types.ObjectId | null = null;
    if (dto.teamId) {
      normalizedTeamId = this.toObjectId(dto.teamId, 'teamId');
      const team = await this.teamModel.findOne({ _id: normalizedTeamId, clubId: clubObjectId }).select('_id');
      if (!team) {
        throw new ForbiddenException('Team not found in your club');
      }

      const mismatched = users.some((user) => String(user.teamId ?? '') !== String(normalizedTeamId));
      if (mismatched) {
        throw new ForbiddenException('Team group conversations must contain only members of the same team');
      }
    }

    const conversation = await this.conversationModel.create({
      type: MessagingConversationType.GROUP,
      clubId: clubObjectId,
      teamId: normalizedTeamId,
      participants: users.map((user) => new Types.ObjectId(String(user._id))),
      participantKey: null,
      title: dto.title?.trim() || (normalizedTeamId ? 'Team Conversation' : 'Club Group'),
      lastMessage: null,
      createdBy: new Types.ObjectId(actorContext.userId)
    });

    return this.getConversationViewForActorById(actorContext, String(conversation._id));
  }

  async listMessages(actor: AuthUser, conversationId: string, query: ListMessagesDto) {
    const actorContext = await this.resolveActorContext(actor);
    const conversation = await this.getConversationForActor(actorContext, conversationId);

    const limit = Math.min(Math.max(Number(query.limit ?? 40), 1), 120);
    const filter: FilterQuery<MessagingMessageDocument> = {
      clubId: new Types.ObjectId(actorContext.clubId),
      conversationId: conversation._id
    };

    if (query.before) {
      const beforeDate = new Date(query.before);
      if (Number.isNaN(beforeDate.getTime())) {
        throw new BadRequestException('Invalid before cursor');
      }
      filter.createdAt = { $lt: beforeDate };
    }

    const rows = await this.messageModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const items = rows.reverse().map((row) => this.toMessageView(row));

    const readResult = await this.markConversationReadInternal(
      actorContext,
      String(conversation._id)
    );

    return {
      items,
      hasMore: rows.length === limit,
      nextBefore: rows.length > 0 ? rows[rows.length - 1].createdAt : null,
      readCount: readResult.readCount
    };
  }

  async sendMessage(actor: AuthUser, conversationId: string, dto: SendMessageDto) {
    const actorContext = await this.resolveActorContext(actor);
    return this.sendMessageByActorContext(actorContext, conversationId, dto);
  }

  async sendSocketMessage(actor: AuthUser, dto: SocketSendMessageDto) {
    const actorContext = await this.resolveActorContext(actor);

    let conversationId = dto.conversationId;
    if (!conversationId) {
      if (!dto.recipientUserId) {
        throw new BadRequestException('conversationId or recipientUserId is required');
      }

      const privateConversation = await this.createPrivateConversation(actor, {
        targetUserId: dto.recipientUserId
      });
      conversationId = privateConversation.id;
    }

    const payload: SendMessageDto = {
      content: dto.content,
      type: dto.type,
      metadata: dto.metadata
    };

    return this.sendMessageByActorContext(actorContext, conversationId, payload);
  }

  async markConversationRead(actor: AuthUser, conversationId: string) {
    const actorContext = await this.resolveActorContext(actor);
    return this.markConversationReadInternal(actorContext, conversationId);
  }

  async getConversationSummaryForActor(actor: AuthUser, conversationId: string) {
    const actorContext = await this.resolveActorContext(actor);
    return this.getConversationViewForActorById(actorContext, conversationId);
  }

  async getConversationParticipantUserIdsForActor(actor: AuthUser, conversationId: string) {
    const actorContext = await this.resolveActorContext(actor);
    const conversation = await this.getConversationForActor(actorContext, conversationId);
    return conversation.participants.map((id) => String(id));
  }

  private async sendMessageByActorContext(
    actorContext: MessagingActorContext,
    conversationId: string,
    dto: SendMessageDto
  ) {
    const content = dto.content?.trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const conversation = await this.getConversationForActor(actorContext, conversationId);
    const actorObjectId = new Types.ObjectId(actorContext.userId);

    const message = await this.messageModel.create({
      clubId: new Types.ObjectId(actorContext.clubId),
      conversationId: conversation._id,
      senderId: actorObjectId,
      type: dto.type ?? MessagingMessageType.TEXT,
      content,
      readBy: [actorObjectId],
      metadata: dto.metadata ?? {}
    });

    conversation.lastMessage = {
      id: new Types.ObjectId(String(message._id)),
      senderId: actorObjectId,
      type: message.type,
      content: this.messagePreview(message.type, message.content),
      createdAt: message.createdAt
    };
    await conversation.save();

    const participantIds = conversation.participants.map((id) => String(id));
    const recipientUserIds = participantIds.filter((userId) => userId !== actorContext.userId);

    if (recipientUserIds.length > 0) {
      await this.notificationsService.createChatMessageNotifications({
        clubId: actorContext.clubId,
        senderUserId: actorContext.userId,
        senderName: `${actorContext.firstName} ${actorContext.lastName}`.trim() || actorContext.email,
        conversationId: String(conversation._id),
        messageId: String(message._id),
        preview: this.messagePreview(message.type, message.content),
        recipientUserIds
      });
    }

    return {
      conversationId: String(conversation._id),
      conversationType: conversation.type,
      participantUserIds: participantIds,
      recipientUserIds,
      message: this.toMessageView(message)
    };
  }

  private async getConversationViewForActorById(actor: MessagingActorContext, conversationId: string) {
    const conversation = await this.getConversationForActor(actor, conversationId);

    const participantProfiles = await this.userModel
      .find({
        _id: { $in: conversation.participants },
        clubId: new Types.ObjectId(actor.clubId)
      })
      .select('_id firstName lastName role photoUrl teamId')
      .lean();

    const userMap = new Map<string, UserDocument & { _id: Types.ObjectId }>();
    for (const user of participantProfiles) {
      userMap.set(String(user._id), user as UserDocument & { _id: Types.ObjectId });
    }

    const unreadCount = await this.messageModel.countDocuments({
      clubId: new Types.ObjectId(actor.clubId),
      conversationId: conversation._id,
      senderId: { $ne: new Types.ObjectId(actor.userId) },
      readBy: { $ne: new Types.ObjectId(actor.userId) }
    });

    return this.toConversationView(conversation.toObject(), actor, userMap, unreadCount);
  }

  private async markConversationReadInternal(actor: MessagingActorContext, conversationId: string) {
    const conversation = await this.getConversationForActor(actor, conversationId);
    const actorObjectId = new Types.ObjectId(actor.userId);

    const result = await this.messageModel.updateMany(
      {
        clubId: new Types.ObjectId(actor.clubId),
        conversationId: conversation._id,
        senderId: { $ne: actorObjectId },
        readBy: { $ne: actorObjectId }
      },
      {
        $addToSet: { readBy: actorObjectId }
      }
    );

    return {
      conversationId: String(conversation._id),
      readAt: new Date().toISOString(),
      readCount: result.modifiedCount
    };
  }

  private async getConversationForActor(actor: MessagingActorContext, conversationId: string) {
    const conversationObjectId = this.toObjectId(conversationId, 'conversationId');
    const conversation = await this.conversationModel.findOne({
      _id: conversationObjectId,
      clubId: new Types.ObjectId(actor.clubId),
      participants: new Types.ObjectId(actor.userId)
    });

    if (!conversation) {
      throw new ForbiddenException('Conversation not found in your club scope');
    }

    if (!this.isConversationVisibleToActor(conversation, actor)) {
      throw new ForbiddenException('Conversation is outside your team scope');
    }

    return conversation;
  }

  private async resolveActorContext(actor: AuthUser): Promise<MessagingActorContext> {
    if (!actor.clubId) {
      throw new ForbiddenException('Club-scoped access is required for messaging');
    }

    const actorObjectId = this.toObjectId(actor.sub, 'actor user id');
    const clubObjectId = this.toObjectId(actor.clubId, 'actor club id');

    const user = await this.userModel
      .findOne({ _id: actorObjectId, clubId: clubObjectId, status: UserStatus.ACTIVE })
      .select('_id email role clubId teamId firstName lastName');

    if (!user) {
      throw new ForbiddenException('Active user not found in your club scope');
    }

    return {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      clubId: String(user.clubId),
      teamId: user.teamId ? String(user.teamId) : null,
      firstName: user.firstName,
      lastName: user.lastName
    };
  }

  private toConversationView(
    conversation: {
      _id: Types.ObjectId;
      type: MessagingConversationType;
      title?: string | null;
      teamId?: Types.ObjectId | null;
      participants: Types.ObjectId[];
      lastMessage?: {
        content: string;
        createdAt: Date;
      } | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
    actor: MessagingActorContext,
    users: Map<string, UserDocument & { _id: Types.ObjectId }>,
    unreadCount: number
  ) {
    const participantViews: ConversationParticipantView[] = conversation.participants
      .map((id) => {
        const user = users.get(String(id));
        if (!user) {
          return null;
        }

        return {
          userId: String(user._id),
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          teamId: user.teamId ? String(user.teamId) : null,
          photoUrl: user.photoUrl ?? null
        };
      })
      .filter((row): row is ConversationParticipantView => row !== null);

    const otherParticipant =
      conversation.type === MessagingConversationType.PRIVATE
        ? participantViews.find((row) => row.userId !== actor.userId)
        : null;

    const displayTitle =
      conversation.type === MessagingConversationType.PRIVATE
        ? `${otherParticipant?.firstName ?? ''} ${otherParticipant?.lastName ?? ''}`.trim() ||
          'Private conversation'
        : (conversation.title ?? '').trim() ||
          (conversation.teamId ? 'Team conversation' : 'Club conversation');

    return {
      _id: String(conversation._id),
      id: String(conversation._id),
      type: conversation.type,
      clubId: actor.clubId,
      teamId: conversation.teamId ? String(conversation.teamId) : null,
      participants: participantViews,
      title: conversation.title ?? null,
      displayTitle,
      unreadCount,
      lastMessage: conversation.lastMessage ?? null,
      lastMessagePreview: conversation.lastMessage?.content ?? '',
      lastMessageAt: conversation.lastMessage?.createdAt ?? null,
      createdAt: conversation.createdAt ?? null,
      updatedAt: conversation.updatedAt ?? null
    };
  }

  private toMessageView(
    message:
      | (MessagingMessageDocument & {
          _id: Types.ObjectId;
          clubId: Types.ObjectId;
          conversationId: Types.ObjectId;
          senderId: Types.ObjectId;
        })
      | {
          _id: Types.ObjectId;
          clubId: Types.ObjectId;
          conversationId: Types.ObjectId;
          senderId: Types.ObjectId;
          type: MessagingMessageType;
          content: string;
          readBy: Types.ObjectId[];
          metadata?: Record<string, unknown>;
          createdAt: Date;
          updatedAt: Date;
        }
  ) {
    return {
      _id: String(message._id),
      id: String(message._id),
      conversationId: String(message.conversationId),
      clubId: String(message.clubId),
      senderId: String(message.senderId),
      type: message.type,
      content: message.content,
      readBy: (message.readBy ?? []).map((userId) => String(userId)),
      metadata: message.metadata ?? {},
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }

  private isConversationVisibleToActor(
    conversation: {
      type: MessagingConversationType;
      teamId?: Types.ObjectId | null;
    },
    actor: MessagingActorContext
  ) {
    if (conversation.type !== MessagingConversationType.GROUP) {
      return true;
    }

    if (!conversation.teamId) {
      return true;
    }

    return actor.teamId !== null && String(conversation.teamId) === actor.teamId;
  }

  private toObjectId(raw: string, field: string) {
    if (!Types.ObjectId.isValid(raw)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(raw);
  }

  private buildParticipantKey(ids: string[]) {
    return [...ids].sort((a, b) => a.localeCompare(b)).join(':');
  }

  private messagePreview(type: MessagingMessageType, content: string) {
    if (type === MessagingMessageType.IMAGE) {
      return '[Image]';
    }

    if (type === MessagingMessageType.FILE) {
      return '[File]';
    }

    return content.length > 140 ? `${content.slice(0, 140)}...` : content;
  }
}
