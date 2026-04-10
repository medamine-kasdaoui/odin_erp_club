import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { AuthUser } from '../common/interfaces/auth-user.interface';

interface UploadedBinaryFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  filename?: string;
}

@Injectable()
export class UploadsService {
  private readonly root = join(process.cwd(), 'uploads');

  async saveFile(user: AuthUser, file: UploadedBinaryFile) {
    if (!user.clubId) {
      throw new BadRequestException('Club scope is required for uploads');
    }

    if (file.path && file.filename) {
      return {
        url: `/uploads/${user.clubId}/${file.filename}`,
        mimeType: file.mimetype,
        name: file.originalname,
        size: file.size
      };
    }

    if (!file.buffer) {
      throw new BadRequestException('Uploaded file buffer is missing');
    }

    const ext = extname(file.originalname || '').trim() || this.guessExtension(file.mimetype);
    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const clubFolder = join(this.root, user.clubId);
    await mkdir(clubFolder, { recursive: true });

    const fullPath = join(clubFolder, filename);
    await writeFile(fullPath, file.buffer);

    return {
      url: `/uploads/${user.clubId}/${filename}`,
      mimeType: file.mimetype,
      name: file.originalname,
      size: file.size
    };
  }

  private guessExtension(mimeType: string): string {
    if (mimeType === 'image/png') {
      return '.png';
    }
    if (mimeType === 'image/jpeg') {
      return '.jpg';
    }
    if (mimeType === 'image/webp') {
      return '.webp';
    }
    if (mimeType === 'application/pdf') {
      return '.pdf';
    }
    if (mimeType === 'video/mp4') {
      return '.mp4';
    }
    if (mimeType === 'video/quicktime') {
      return '.mov';
    }
    if (mimeType === 'video/x-matroska') {
      return '.mkv';
    }
    if (mimeType === 'video/webm') {
      return '.webm';
    }
    if (mimeType === 'video/x-msvideo') {
      return '.avi';
    }
    return '.bin';
  }
}
