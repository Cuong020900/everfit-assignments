import { randomUUID } from 'node:crypto';
import type { NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
