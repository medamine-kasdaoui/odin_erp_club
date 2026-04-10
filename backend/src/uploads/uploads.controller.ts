import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
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
import { UploadsService } from './uploads.service';

interface UploadedBinaryFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  filename?: string;
}

interface RequestWithAuthUser {
  user?: AuthUser;
}

const MAX_UPLOAD_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

function guessExtension(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/x-matroska') return '.mkv';
  if (mimeType === 'video/webm') return '.webm';
  if (mimeType === 'video/x-msvideo') return '.avi';
  return '.bin';
}

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(
  Role.CLUB_RESPONSABLE,
  Role.FINANCIER,
  Role.JOUEUR,
  Role.STAFF_TECHNIQUE,
  Role.STAFF_MEDICAL
)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Permissions(Permission.DOC_SHARE)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: RequestWithAuthUser, _file, cb) => {
          const clubId = req.user?.clubId;
          if (!clubId) {
            cb(new Error('Club scope is required for uploads'), '');
            return;
          }
          const folder = join(process.cwd(), 'uploads', clubId);
          mkdirSync(folder, { recursive: true });
          cb(null, folder);
        },
        filename: (_req, file, cb) => {
          const rawExt = extname(file.originalname || '').trim();
          const ext = rawExt || guessExtension(file.mimetype);
          cb(null, `${Date.now()}-${randomUUID()}${ext}`);
        }
      }),
      limits: {
        fileSize: MAX_UPLOAD_FILE_SIZE_BYTES
      }
    })
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedBinaryFile) {
    if (!file) {
      return { message: 'No file uploaded' };
    }

    return this.uploadsService.saveFile(user, file);
  }
}
