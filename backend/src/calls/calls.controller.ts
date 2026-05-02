import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { Permission } from "../common/enums/permission.enum";
import { Role } from "../common/enums/role.enum";
import { ActiveUserGuard } from "../common/guards/active-user.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import {
  IssueCallTokenDto,
  ListCallHistoryDto,
  RegisterPushTokenDto,
  RemovePushTokenDto,
} from "./dto/calls.dto";
import { CallsService } from "./calls.service";

@ApiTags("calls")
@ApiBearerAuth()
@Controller("calls")
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(
  Role.CLUB_RESPONSABLE,
  Role.FINANCIER,
  Role.JOUEUR,
  Role.STAFF_TECHNIQUE,
  Role.STAFF_MEDICAL,
  Role.SCOUT,
)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Permissions(Permission.CHAT_WRITE)
  @Post("push-token")
  registerPushToken(
    @CurrentUser() actor: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.callsService.registerPushToken(actor, dto);
  }

  @Permissions(Permission.CHAT_WRITE)
  @Post("push-token/remove")
  removePushToken(
    @CurrentUser() actor: AuthUser,
    @Body() dto: RemovePushTokenDto,
  ) {
    return this.callsService.removePushToken(actor, dto);
  }

  @Permissions(Permission.CHAT_READ)
  @Get("history")
  listCallHistory(
    @CurrentUser() actor: AuthUser,
    @Query() query: ListCallHistoryDto,
  ) {
    return this.callsService.listCallHistory(actor, query);
  }

  @Permissions(Permission.CHAT_READ)
  @Get(":callId")
  getCallSession(
    @CurrentUser() actor: AuthUser,
    @Param("callId") callId: string,
  ) {
    return this.callsService.getCallSessionForActor(actor, callId);
  }

  @Permissions(Permission.CHAT_WRITE)
  @Post("token")
  async issueToken(
    @CurrentUser() actor: AuthUser,
    @Body() dto: IssueCallTokenDto,
  ) {
    const result = await this.callsService.issueAgoraToken(actor, dto.callId);

    return {
      callId: result.session.id,
      conversationId: result.session.conversationId,
      channelId: result.session.channelId,
      mediaType: result.session.mediaType,
      sessionType: result.session.sessionType,
      token: result.token,
    };
  }
}
