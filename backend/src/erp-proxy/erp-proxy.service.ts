import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

type ProxyRequest = {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  clubId?: string;
  headers?: Record<string, string | undefined>;
};

type ProxyResponse = {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
};

@Injectable()
export class ErpProxyService {
  private readonly logger = new Logger(ErpProxyService.name);
  private serviceToken: string | null = null;
  private refreshingToken?: Promise<string>;
  private missingEnv = false;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService
  ) {}

  async forward(request: ProxyRequest): Promise<ProxyResponse> {
    const scopedRequest = this.applyClubScope(request);
    const url = this.buildUrl(scopedRequest.path, scopedRequest.query);
    const token = await this.getServiceToken();

    try {
      return await this.performRequest(url, token, scopedRequest);
    } catch (error) {
      const status = this.extractStatus(error);
      if (status === 401) {
        this.serviceToken = null;
        const refreshed = await this.getServiceToken(true);
        return await this.performRequest(url, refreshed, scopedRequest);
      }
      throw this.toHttpException(error);
    }
  }

  private async performRequest(
    url: string,
    token: string,
    request: ProxyRequest
  ): Promise<ProxyResponse> {
    const config: AxiosRequestConfig = {
      method: request.method,
      url,
      params: request.query,
      data: request.body,
      headers: {
        'Content-Type': request.headers?.['content-type'] ?? 'application/json',
        Accept: request.headers?.accept ?? 'application/json',
        Authorization: `Bearer ${token}`
      },
      validateStatus: () => true
    };

    const response: AxiosResponse = await this.http.axiosRef.request(config);
    if (response.status >= 200 && response.status < 300) {
      return {
        status: response.status,
        data: response.data,
        headers: this.pickHeaders(response)
      };
    }

    throw new HttpException(
      response.data ?? 'Upstream error',
      response.status
    );
  }

  private buildUrl(path: string, query?: Record<string, unknown>) {
    const base = this.config.get<string>('TESSNIM_API_BASE') ?? 'http://localhost:3001/api/v1';
    const trimmedBase = base.replace(/\/+$/, '');
    const trimmedPath = path.replace(/^\/+/, '');
    const url = `${trimmedBase}/${trimmedPath}`;
    return url;
  }

  private async getServiceToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.serviceToken) {
      return this.serviceToken;
    }
    if (!this.refreshingToken) {
      this.refreshingToken = this.loginServiceUser()
        .finally(() => (this.refreshingToken = undefined));
    }
    return this.refreshingToken;
  }

  private async loginServiceUser(): Promise<string> {
    const email = this.config.get<string>('TESSNIM_SERVICE_EMAIL') ?? '';
    const password = this.config.get<string>('TESSNIM_SERVICE_PASSWORD') ?? '';
    if (!email || !password) {
      if (!this.missingEnv) {
        this.logger.error(
          'Missing TESSNIM_SERVICE_EMAIL or TESSNIM_SERVICE_PASSWORD env values.'
        );
        this.missingEnv = true;
      }
      throw new HttpException('ERP proxy is not configured', 500);
    }

    const base = this.config.get<string>('TESSNIM_API_BASE') ?? 'http://localhost:3001/api/v1';
    const url = `${base.replace(/\/+$/, '')}/auth/login`;
    try {
      const response = await axios.post(url, { email, password }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        validateStatus: () => true
      });
      if (response.status < 200 || response.status >= 300) {
        this.logger.error(`Failed to login service user: ${response.status}`);
        throw new HttpException('ERP proxy authentication failed', 502);
      }

      const token = response.data?.accessToken;
      if (!token) {
        throw new HttpException('ERP proxy authentication token missing', 502);
      }

      this.serviceToken = token;
      return token;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to login service user', error as Error);
      throw new HttpException('ERP proxy authentication failed', 502);
    }
  }

  private extractStatus(error: unknown): number | undefined {
    if (error instanceof HttpException) {
      return error.getStatus();
    }
    if (axios.isAxiosError(error)) {
      return error.response?.status;
    }
    return undefined;
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const data = error.response?.data ?? 'Upstream error';
      return new HttpException(data, status);
    }
    return new HttpException('ERP proxy error', 502);
  }

  private pickHeaders(response: AxiosResponse): Record<string, string> {
    const headers: Record<string, string> = {};
    const contentType = response.headers?.['content-type'];
    if (contentType) {
      headers['content-type'] = contentType;
    }
    return headers;
  }

  private applyClubScope(request: ProxyRequest): ProxyRequest {
    const clubId = request.clubId;
    if (!clubId || !this.shouldInjectClubId(request.path)) {
      return request;
    }

    const method = request.method?.toUpperCase() ?? '';
    if (method === 'GET' || method === 'DELETE') {
      const nextQuery: Record<string, unknown> = {
        ...(request.query ?? {})
      };
      if (nextQuery['clubId'] == null) {
        nextQuery['clubId'] = clubId;
      }
      return { ...request, query: nextQuery };
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      if (this.isPlainObject(request.body)) {
        const body = request.body as Record<string, unknown>;
        if (body['clubId'] == null) {
          return { ...request, body: { ...body, clubId } };
        }
      }
    }

    return request;
  }

  private shouldInjectClubId(path: string): boolean {
    const normalized = path.replace(/^\/+/, '').toLowerCase();
    return (
      normalized.startsWith('players') ||
      normalized.startsWith('teams') ||
      normalized.startsWith('categories') ||
      normalized.startsWith('staff') ||
      normalized.startsWith('events')
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}
