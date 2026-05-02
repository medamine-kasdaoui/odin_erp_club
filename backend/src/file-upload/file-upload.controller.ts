import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Controller('uploads')
export class FileUploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads',
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          cb(null, `${Date.now()}-${randomUUID()}${extension}`);
        },
      }),
    }),
  )
  upload(@UploadedFile() file?: any) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return {
      url: `/uploads/${file.filename}`,
      mimeType: file.mimetype || 'application/octet-stream',
      name: file.originalname || file.filename,
      size: file.size || 0,
    };
  }
}

