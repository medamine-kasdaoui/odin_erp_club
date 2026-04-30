import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { MedicalVisionService } from "./medical-vision.service";

type UploadedImageFile = {
  path: string;
  mimetype?: string;
  originalname?: string;
};

const imageFilter = (
  _req: any,
  file: { mimetype?: string; originalname?: string },
  callback: (error: any, acceptFile: boolean) => void,
) => {
  const mimetype = (file.mimetype ?? "").toLowerCase();
  const extension = extname(file.originalname ?? "").toLowerCase();
  const hasImageMime = mimetype.startsWith("image/");
  const hasImageExtension = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".heic",
    ".heif",
  ].includes(extension);

  if (!hasImageMime && !hasImageExtension) {
    return callback(
      new BadRequestException("Only image files are allowed."),
      false,
    );
  }
  return callback(null, true);
};

const buildStorage = (folder: string) =>
  diskStorage({
    destination: (_req, _file, callback) => {
      const uploadDir = join(process.cwd(), "uploads", "medical", folder);
      mkdirSync(uploadDir, { recursive: true });
      callback(null, uploadDir);
    },
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname ?? "") || ".jpg";
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  });

@Controller("medical/vision")
export class MedicalVisionController {
  constructor(private readonly visionService: MedicalVisionService) {}

  @Post("injury")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: buildStorage("injury"),
      fileFilter: imageFilter,
    }),
  )
  async detectInjury(@UploadedFile() file?: UploadedImageFile) {
    if (!file) {
      throw new BadRequestException("Image file is required.");
    }
    return this.visionService.detectInjury(file.path);
  }

  @Post("gym")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: buildStorage("gym"),
      fileFilter: imageFilter,
    }),
  )
  async detectGym(@UploadedFile() file?: UploadedImageFile) {
    if (!file) {
      throw new BadRequestException("Image file is required.");
    }
    return this.visionService.detectGym(file.path);
  }
}
