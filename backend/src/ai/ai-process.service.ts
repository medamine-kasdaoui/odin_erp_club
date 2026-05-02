import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

@Injectable()
export class AiProcessService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(AiProcessService.name);
  private aiProcess?: ChildProcess;
  private stopping = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    if (!this.isAutostartEnabled()) {
      this.logger.log('AI Python autostart disabled by configuration.');
      return;
    }

    const aiUrl = this.getAiServiceUrl();
    if (!this.isLocalAiService(aiUrl)) {
      this.logger.log(
        `AI service points to ${aiUrl}; skipping local Python autostart.`,
      );
      return;
    }

    if (await this.isServiceReachable(aiUrl)) {
      this.logger.log(`AI Python service already reachable at ${aiUrl}.`);
      return;
    }

    this.startPythonProcess(aiUrl);
  }

  onApplicationShutdown() {
    this.stopPythonProcess();
  }

  private isAutostartEnabled() {
    const value =
      this.configService.get<string>('AI_SERVICE_AUTOSTART') ?? 'true';
    return value.trim().toLowerCase() !== 'false';
  }

  private getAiServiceUrl() {
    return (
      this.configService.get<string>('AI_SERVICE_URL')?.trim() ||
      'http://localhost:8000'
    );
  }

  private isLocalAiService(aiServiceUrl: string) {
    try {
      const url = new URL(aiServiceUrl);
      return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
    } catch {
      this.logger.warn(
        `Invalid AI_SERVICE_URL "${aiServiceUrl}". Skipping Python autostart.`,
      );
      return false;
    }
  }

  private async isServiceReachable(aiServiceUrl: string) {
    try {
      const response = await fetch(aiServiceUrl, {
        signal: AbortSignal.timeout(1500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private startPythonProcess(aiServiceUrl: string) {
    const scriptPath = this.resolveScriptPath();
    if (!scriptPath) {
      return;
    }

    const pythonExecutable =
      this.configService.get<string>('AI_SERVICE_PYTHON')?.trim() || 'python';
    const pythonArgs = this.parseArgs(
      this.configService.get<string>('AI_SERVICE_PYTHON_ARGS'),
    );
    const { host, port } = this.extractHostPort(aiServiceUrl);

    this.logger.log(
      `Starting AI Python service with "${pythonExecutable} ${[
        ...pythonArgs,
        scriptPath,
      ].join(' ')}".`,
    );

    this.stopping = false;
    this.aiProcess = spawn(
      pythonExecutable,
      [...pythonArgs, scriptPath],
      {
        cwd: dirname(scriptPath),
        env: {
          ...process.env,
          AI_SERVICE_HOST: host,
          AI_SERVICE_PORT: String(port),
          PYTHONUNBUFFERED: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    this.aiProcess.stdout?.on('data', (chunk: Buffer | string) => {
      const message = chunk.toString().trim();
      if (message) {
        this.logger.log(`[ai-python] ${message}`);
      }
    });

    this.aiProcess.stderr?.on('data', (chunk: Buffer | string) => {
      const message = chunk.toString().trim();
      if (message) {
        this.logger.warn(`[ai-python] ${message}`);
      }
    });

    this.aiProcess.on('error', (error) => {
      this.logger.error(
        `Failed to start AI Python service: ${error.message}`,
        error.stack,
      );
      this.aiProcess = undefined;
    });

    this.aiProcess.on('exit', (code, signal) => {
      const expectedStop = this.stopping;
      this.aiProcess = undefined;
      if (expectedStop) {
        this.logger.log('AI Python service stopped.');
        return;
      }

      this.logger.error(
        `AI Python service exited unexpectedly (code: ${code ?? 'null'}, signal: ${signal ?? 'null'}).`,
      );
    });
  }

  private stopPythonProcess() {
    if (!this.aiProcess || this.aiProcess.killed) {
      return;
    }

    this.stopping = true;
    this.logger.log('Stopping AI Python service...');
    this.aiProcess.kill();
  }

  private resolveScriptPath() {
    const configured = this.configService.get<string>('AI_SERVICE_SCRIPT')?.trim();
    const scriptPath =
      configured || join(process.cwd(), 'ModeleAIpython', 'main.py');

    if (!existsSync(scriptPath)) {
      this.logger.error(
        `AI Python script not found at ${scriptPath}. Set AI_SERVICE_SCRIPT to override the path.`,
      );
      return null;
    }

    return scriptPath;
  }

  private extractHostPort(aiServiceUrl: string) {
    try {
      const url = new URL(aiServiceUrl);
      return {
        host: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
        port: Number(url.port || '8000'),
      };
    } catch {
      return { host: '127.0.0.1', port: 8000 };
    }
  }

  private parseArgs(value?: string) {
    if (!value) {
      return [];
    }

    return value
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
