import { All, Controller, Param, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { ErpProxyService } from './erp-proxy.service';

@Controller('erp')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpProxyController {
  constructor(private readonly proxy: ErpProxyService) {}

  @All(':path(*)')
  async handleProxy(
    @Param('path') path: string,
    @Req() req: Request & { body?: unknown; query?: unknown; user?: any },
    @Res() res: Response
  ) {
    const clubId = req.user?.clubId as string | undefined;
    const result = await this.proxy.forward({
      method: req.method,
      path: path ?? '',
      query: req.query as Record<string, unknown>,
      body: req.body,
      clubId,
      headers: {
        'content-type': (req as any).headers?.['content-type'],
        accept: (req as any).headers?.['accept']
      }
    });

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        if (value !== undefined) {
          res.setHeader(key, value as string);
        }
      }
    }

    res.status(result.status).send(result.data);
  }
}
