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

type InjuryCarePlan = {
  injuryName: string;
  advice: string[];
  rehab: string[];
};

type GymEquipmentPlan = {
  equipmentName: string;
  muscles: string[];
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

const buildInjuryCarePlan = (label: string): InjuryCarePlan => {
  const key = (label || "").trim().toLowerCase();

  switch (key) {
    case "abrasion":
      return {
        injuryName: "Abrasion",
        advice: [
          "Clean the wound with clean water and mild soap.",
          "Apply antiseptic and cover with a sterile dressing.",
          "Monitor for redness, swelling, or discharge.",
        ],
        rehab: [
          "Change dressing daily and keep area dry.",
          "Avoid friction or contact for 48 hours.",
          "Resume training gradually once pain-free.",
        ],
      };
    case "bruise":
      return {
        injuryName: "Bruise",
        advice: [
          "Rest and protect the area.",
          "Apply ice 15-20 minutes every 2-3 hours.",
          "Use light compression if swelling appears.",
        ],
        rehab: [
          "Gentle range of motion after 24-48 hours.",
          "Return to light activity if pain is minimal.",
          "Avoid impact until tenderness resolves.",
        ],
      };
    case "burn":
      return {
        injuryName: "Burn",
        advice: [
          "Cool the area under running water for 10-15 minutes.",
          "Cover with a sterile, non-stick dressing.",
          "Seek care if blistering is severe or pain persists.",
        ],
        rehab: [
          "Keep area clean and moisturized as advised.",
          "Avoid sun exposure during healing.",
          "Resume training only when skin is intact and pain-free.",
        ],
      };
    case "cut":
      return {
        injuryName: "Cut",
        advice: [
          "Apply direct pressure to stop bleeding.",
          "Clean with saline or clean water.",
          "Use a sterile dressing and monitor for infection.",
        ],
        rehab: [
          "Change dressing daily or when wet.",
          "Avoid heavy contact until closed.",
          "Seek stitches if the wound edges do not close.",
        ],
      };
    case "normal":
      return {
        injuryName: "No injury detected",
        advice: [
          "No visible injury detected.",
          "Continue normal recovery and hygiene.",
        ],
        rehab: ["No rehab steps required."],
      };
    default:
      return {
        injuryName: label && label.trim().length > 0 ? label : "Unknown",
        advice: ["Monitor symptoms and seek medical advice if pain persists."],
        rehab: ["Follow standard recovery protocols and rest as needed."],
      };
  }
};

const buildGymEquipmentPlan = (label: string): GymEquipmentPlan => {
  const key = (label || "").trim().toLowerCase();

  switch (key) {
    case "bench press":
      return {
        equipmentName: "Bench press",
        muscles: ["Chest (pectorals)", "Triceps", "Front deltoids"],
      };
    case "dumbells":
    case "dumbbells":
      return {
        equipmentName: "Dumbbells",
        muscles: ["Chest", "Shoulders", "Arms (biceps/triceps)", "Back"],
      };
    case "elliptical machine":
      return {
        equipmentName: "Elliptical machine",
        muscles: ["Quads", "Hamstrings", "Glutes", "Cardio endurance"],
      };
    case "lat pulldown":
      return {
        equipmentName: "Lat pulldown",
        muscles: ["Lats", "Upper back", "Biceps"],
      };
    case "leg press":
      return {
        equipmentName: "Leg press",
        muscles: ["Quads", "Glutes", "Hamstrings"],
      };
    case "recumbent bike":
      return {
        equipmentName: "Recumbent bike",
        muscles: ["Quads", "Hamstrings", "Low-impact cardio"],
      };
    case "shoulder press machine":
      return {
        equipmentName: "Shoulder press machine",
        muscles: ["Deltoids", "Triceps", "Upper chest"],
      };
    case "smith machine":
      return {
        equipmentName: "Smith machine",
        muscles: ["Quads", "Glutes", "Chest", "Shoulders"],
      };
    default:
      return {
        equipmentName: label && label.trim().length > 0 ? label : "Unknown",
        muscles: ["Full-body", "Varies by exercise"],
      };
  }
};

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
    const result = await this.visionService.detectInjury(file.path);
    const carePlan = buildInjuryCarePlan(result.label);
    return {
      ...result,
      ...carePlan,
    };
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
    const result = await this.visionService.detectGym(file.path);
    const equipmentPlan = buildGymEquipmentPlan(result.label);
    return {
      ...result,
      ...equipmentPlan,
    };
  }
}
