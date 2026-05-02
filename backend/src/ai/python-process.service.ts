import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class PythonProcessService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PythonProcessService.name);
  private readonly processes = new Map<string, ChildProcess>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    if (!this.isEnabled('AI_SERVICE_AUTOSTART', true)) {
      this.logger.log('AI_SERVICE_AUTOSTART=false, skipping AI model autostart.');
      return;
    }

    // Fire-and-forget to avoid blocking Nest startup.
    this.startAllServices().catch((err) => {
      this.logger.error(`Async Python startup failed: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.stopAllServices();
  }

  private async startAllServices() {
    await this.startService({
      key: 'ai-core',
      url:
        this.configService.get<string>('AI_SERVICE_URL') ||
        'http://localhost:8000',
      dir:
        this.configService.get<string>('AI_MODEL_DIR') ||
        join(process.cwd(), 'ModeleAIpython'),
      pythonBinEnvKey: 'AI_SERVICE_PYTHON_BIN',
      enableFlag: 'AI_CORE_AUTOSTART',
      defaultEnabled: true,
    });

    await this.startService({
      key: 'player-value-ai',
      url:
        this.configService.get<string>('PLAYER_VALUE_AI_URL') ||
        'http://localhost:8002',
      dir:
        this.configService.get<string>('PLAYER_VALUE_AI_MODEL_DIR') ||
        join(process.cwd(), 'player_value_ai'),
      pythonBinEnvKey: 'PLAYER_VALUE_AI_PYTHON_BIN',
      enableFlag: 'PLAYER_VALUE_AI_AUTOSTART',
      defaultEnabled: true,
    });

    await this.startService({
      key: 'finance-ai',
      url:
        this.configService.get<string>('FINANCE_AI_URL') ||
        'http://localhost:8200',
      dir:
        this.configService.get<string>('FINANCE_AI_MODEL_DIR') ||
        join(process.cwd(), 'finance_ai_ml'),
      pythonBinEnvKey: 'FINANCE_AI_PYTHON_BIN',
      enableFlag: 'FINANCE_AI_AUTOSTART',
      defaultEnabled: true,
    });
  }

  private async startService(config: {
    key: string;
    url: string;
    dir: string;
    pythonBinEnvKey: string;
    enableFlag: string;
    defaultEnabled: boolean;
  }) {
    if (!this.isEnabled(config.enableFlag, config.defaultEnabled)) {
      this.logger.log(`${config.enableFlag}=false, skipping ${config.key}.`);
      return;
    }

    const mainFile = join(config.dir, 'main.py');
    if (!existsSync(mainFile)) {
      this.logger.warn(`[${config.key}] main.py not found at ${mainFile}.`);
      return;
    }

    const { host, port } = this.extractHostPort(config.url);
    if (await this.isReachable(config.url)) {
      this.logger.log(
        `[${config.key}] already reachable at ${config.url}, skipping spawn.`,
      );
      return;
    }

    const pythonBin = this.resolvePythonBin(config.dir, config.pythonBinEnvKey);
    this.logger.log(
      `[${config.key}] starting: ${pythonBin} -m uvicorn main:app --host ${host} --port ${port}`,
    );

    const child = spawn(
      pythonBin,
      ['-m', 'uvicorn', 'main:app', '--host', host, '--port', String(port)],
      {
        cwd: config.dir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      },
    );

    this.processes.set(config.key, child);

    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) this.logger.log(`[${config.key}] ${line}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) this.logger.log(`[${config.key}] ${line}`);
    });

    child.on('error', (err) => {
      this.logger.error(`[${config.key}] failed: ${err.message}`);
      this.processes.delete(config.key);
    });

    child.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        this.logger.warn(
          `[${config.key}] exited with code ${code} (signal: ${signal ?? 'none'}).`,
        );
      }
      this.processes.delete(config.key);
    });

    await this.waitForReady(config.key, config.url);
  }

  private async waitForReady(key: string, url: string, maxAttempts = 20) {
    for (let i = 1; i <= maxAttempts; i++) {
      await this.sleep(1000);
      try {
        const response = await fetch(url);
        if (response.ok) {
          this.logger.log(`[${key}] ready at ${url} ✓`);
          return;
        }
      } catch {
        this.logger.log(`[${key}] waiting... (${i}/${maxAttempts})`);
      }
    }
    this.logger.warn(`[${key}] did not respond after ${maxAttempts}s.`);
  }

  private isEnabled(key: string, defaultValue: boolean) {
    const raw = this.configService.get<string | boolean>(key);
    if (raw === undefined || raw === null) return defaultValue;
    if (typeof raw === 'boolean') return raw;
    return raw.trim().toLowerCase() !== 'false';
  }

  private resolvePythonBin(modelDir: string, specificEnvKey: string) {
    const configuredSpecific = this.configService.get<string>(specificEnvKey);
    if (configuredSpecific?.trim()) return configuredSpecific.trim();

    const localVenvPy3 = join(modelDir, '.venv', 'bin', 'python3');
    if (existsSync(localVenvPy3)) return localVenvPy3;

    const localVenvPy = join(modelDir, '.venv', 'bin', 'python');
    if (existsSync(localVenvPy)) return localVenvPy;

    const configuredGlobal = this.configService.get<string>('PYTHON_BIN');
    if (configuredGlobal?.trim()) return configuredGlobal.trim();

    return 'python3';
  }

  private extractHostPort(urlString: string) {
    try {
      const url = new URL(urlString);
      return {
        host: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
        port: Number(url.port || this.defaultPortForHost(url.hostname)),
      };
    } catch {
      return { host: '127.0.0.1', port: 8000 };
    }
  }

  private defaultPortForHost(_hostname: string) {
    return 8000;
  }

  private async isReachable(url: string) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private stopAllServices() {
    for (const [key, proc] of this.processes.entries()) {
      if (!proc.killed) {
        this.logger.log(`[${key}] stopping...`);
        proc.kill('SIGTERM');
      }
    }
    this.processes.clear();
  }

  isRunning(): boolean {
    for (const proc of this.processes.values()) {
      if (proc && !proc.killed) return true;
    }
    return false;
  }
}
