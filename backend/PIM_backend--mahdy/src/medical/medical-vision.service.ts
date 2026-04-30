import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, isAbsolute, resolve } from "path";

type MedicalVisionTopK = {
  label: string;
  confidence: number;
};

export type MedicalVisionResult = {
  kind: "injury" | "gym";
  label: string;
  confidence: number;
  topK: MedicalVisionTopK[];
  model?: string;
  inferenceMs?: number;
};

type VisionConfig = {
  scriptKey: string;
  modelKey: string;
  labelsKey?: string;
};

type PythonRequirement = "basic" | "tensorflow" | "tflite";

@Injectable()
export class MedicalVisionService {
  private readonly logger = new Logger(MedicalVisionService.name);
  private readonly pythonPath: string;
  private readonly injuryConfig: VisionConfig;
  private readonly gymConfig: VisionConfig;
  private readonly resolvedPythonPaths = new Map<PythonRequirement, string>();
  private readonly resolvingPythonPaths = new Map<
    PythonRequirement,
    Promise<string>
  >();

  constructor(private readonly configService: ConfigService) {
    this.pythonPath =
      this.configService.get<string>("MEDICAL_VISION_PYTHON") ||
      this.configService.get<string>("MEDICAL_AI_PYTHON") ||
      "python3";

    this.injuryConfig = {
      scriptKey: "MEDICAL_INJURY_AI_SCRIPT",
      modelKey: "MEDICAL_INJURY_AI_MODEL",
      labelsKey: "MEDICAL_INJURY_AI_LABELS",
    };

    this.gymConfig = {
      scriptKey: "MEDICAL_GYM_AI_SCRIPT",
      modelKey: "MEDICAL_GYM_AI_MODEL",
      labelsKey: "MEDICAL_GYM_AI_LABELS",
    };
  }

  async detectInjury(imagePath: string): Promise<MedicalVisionResult> {
    return this.runVisionAi(this.injuryConfig, imagePath, "injury");
  }

  async detectGym(imagePath: string): Promise<MedicalVisionResult> {
    return this.runVisionAi(this.gymConfig, imagePath, "gym");
  }

  private async runVisionAi(
    config: VisionConfig,
    imagePath: string,
    kind: "injury" | "gym",
  ): Promise<MedicalVisionResult> {
    const scriptPath = this.resolveRequiredPath(config.scriptKey);
    const modelPath = this.resolveRequiredPath(config.modelKey);
    const labelsPath = this.resolveOptionalPath(config.labelsKey);
    const pythonPath = await this.resolvePythonPath(modelPath);

    return new Promise((resolve, reject) => {
      this.logger.log(
        `Vision AI ${kind} using ${pythonPath} (model: ${modelPath})`,
      );

      if (!existsSync(imagePath)) {
        return reject(
          new InternalServerErrorException(
            `Image not found at ${imagePath}`,
          ),
        );
      }

      const args = [
        scriptPath,
        "--image",
        imagePath,
        "--model",
        modelPath,
        "--top",
        "3",
      ];

      if (labelsPath) {
        args.push("--labels", labelsPath);
      }

      const childProcess = spawn(pythonPath, args, {
        cwd: dirname(scriptPath),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      childProcess.on("close", (code) => {
        if (code !== 0) {
          this.logger.warn(
            `Vision AI ${kind} failed (code ${code ?? "null"}): ${
              stderr || "Unknown error"
            }`,
          );
          return reject(
            new InternalServerErrorException(
              `Python error: ${stderr || "Unknown error"}`,
            ),
          );
        }

        const payload = stdout.trim();
        const lastLine = payload.split("\n").filter(Boolean).pop() || "";

        try {
          const parsed = JSON.parse(lastLine);
          resolve(this.normalizeResult(parsed, kind));
        } catch (error) {
          reject(
            new InternalServerErrorException(
              `Invalid JSON from Python (${pythonPath}): ${payload}`,
            ),
          );
        }
      });

      childProcess.on("error", (error) => {
        reject(
          new InternalServerErrorException(
            `Failed to start Python (${pythonPath}): ${error.message}`,
          ),
        );
      });
    });
  }

  private async resolvePythonPath(modelPath: string): Promise<string> {
    const requirement = this.getPythonRequirement(modelPath);
    const cached = this.resolvedPythonPaths.get(requirement);
    if (cached) {
      return cached;
    }

    const pending = this.resolvingPythonPaths.get(requirement);
    if (pending) {
      return pending;
    }

    this.logger.log(`Resolving Python for vision AI (${requirement})...`);
    const resolving = this.findPythonForRequirement(requirement);
    this.resolvingPythonPaths.set(requirement, resolving);

    try {
      const resolved = await resolving;
      this.resolvedPythonPaths.set(requirement, resolved);
      this.logger.log(`Vision AI Python resolved (${requirement}): ${resolved}`);
      return resolved;
    } finally {
      this.resolvingPythonPaths.delete(requirement);
    }
  }

  private async findPythonForRequirement(
    requirement: PythonRequirement,
  ): Promise<string> {
    const candidates = this.buildPythonCandidates();
    this.logger.log(
      `Vision AI Python candidates: ${candidates.join(", ") || "none"}`,
    );
    for (const candidate of candidates) {
      if (isAbsolute(candidate) && !existsSync(candidate)) {
        continue;
      }
      if (await this.canImportForRequirement(candidate, requirement)) {
        return candidate;
      }
    }

    throw new InternalServerErrorException(
      "Python with required packages not available. Install tensorflow/tflite_runtime or set MEDICAL_VISION_PYTHON.",
    );
  }

  private buildPythonCandidates(): string[] {
    const candidates: string[] = [];
    const add = (value?: string) => {
      if (!value) {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed || candidates.includes(trimmed)) {
        return;
      }
      candidates.push(trimmed);
    };

    add(this.configService.get<string>("MEDICAL_VISION_PYTHON"));
    add(this.configService.get<string>("MEDICAL_AI_PYTHON"));
    add(this.pythonPath);

    if (process.platform === "darwin") {
      add("/opt/homebrew/bin/python3");
      add("/usr/local/bin/python3");
    }

    add("python3");
    add("python");

    return candidates;
  }

  private canImportForRequirement(
    pythonPath: string,
    requirement: PythonRequirement,
  ): Promise<boolean> {
    const script = this.buildProbeScript(requirement);
    return new Promise((resolve) => {
      const check = spawn(pythonPath, ["-c", script]);

      check.on("close", (code) => {
        resolve(code === 0);
      });

      check.on("error", () => {
        resolve(false);
      });
    });
  }

  private buildProbeScript(requirement: PythonRequirement): string {
    if (requirement === "tensorflow") {
      return [
        "import numpy",
        "from PIL import Image",
        "import tensorflow as tf",
      ].join("\n");
    }
    if (requirement === "tflite") {
      return [
        "import numpy",
        "from PIL import Image",
        "try:",
        "    import tflite_runtime.interpreter as tflite",
        "except Exception:",
        "    import tensorflow as tf",
      ].join("\n");
    }
    return ["import numpy", "from PIL import Image"].join("\n");
  }

  private getPythonRequirement(modelPath: string): PythonRequirement {
    const lower = modelPath.toLowerCase();
    if (lower.endsWith(".tflite")) {
      return "tflite";
    }
    if (lower.endsWith(".keras") || lower.endsWith(".h5")) {
      return "tensorflow";
    }
    return "basic";
  }

  private normalizeResult(
    payload: any,
    kind: "injury" | "gym",
  ): MedicalVisionResult {
    const label =
      typeof payload?.label === "string" && payload.label.trim().length > 0
        ? payload.label
        : "unknown";

    let confidence = this.coerceNumber(payload?.confidence, 0);
    if (confidence > 1) {
      confidence = confidence / 100;
    }
    confidence = Math.max(0, Math.min(1, confidence));

    const topK = Array.isArray(payload?.topK)
      ? payload.topK
          .map((entry: any) => ({
            label:
              typeof entry?.label === "string"
                ? entry.label
                : "unknown",
            confidence: Math.max(
              0,
              Math.min(1, this.coerceNumber(entry?.confidence, confidence)),
            ),
          }))
          .filter((entry: MedicalVisionTopK) => entry.label.length > 0)
      : [];

    const resultTopK = topK.length > 0 ? topK : [{ label, confidence }];

    return {
      kind,
      label,
      confidence,
      topK: resultTopK,
      model:
        typeof payload?.model === "string" ? payload.model : undefined,
      inferenceMs: this.coerceNumber(payload?.inferenceMs, 0),
    };
  }

  private resolveRequiredPath(configKey: string): string {
    const raw = this.configService.get<string>(configKey, "").trim();
    if (!raw) {
      throw new InternalServerErrorException(
        `Medical vision AI not configured. Set ${configKey}.`,
      );
    }

    const resolved = this.resolvePath(raw);
    if (!existsSync(resolved)) {
      throw new InternalServerErrorException(
        `${configKey} path not found: ${resolved}`,
      );
    }

    return resolved;
  }

  private resolveOptionalPath(configKey?: string): string {
    if (!configKey) {
      return "";
    }
    const raw = this.configService.get<string>(configKey, "").trim();
    if (!raw) {
      return "";
    }

    const resolved = this.resolvePath(raw);
    return existsSync(resolved) ? resolved : "";
  }

  private resolvePath(value: string): string {
    if (isAbsolute(value)) {
      return value;
    }
    return resolve(process.cwd(), value);
  }

  private coerceNumber(value: any, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return fallback;
  }
}
