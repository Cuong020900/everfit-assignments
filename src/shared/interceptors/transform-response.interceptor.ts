import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ApiMeta } from '@src/shared/types/api-response.type';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((value) => {
        if (value === undefined) return value;

        const meta: ApiMeta = {
          timestamp: new Date().toISOString(),
          requestId: String(req.id ?? ''),
        };

        // For null returns, produce a JSON null body (not empty body)
        // by returning an object whose toJSON resolves to null.
        if (value === null) {
          return { toJSON: (): null => null };
        }

        return { ...value, meta };
      }),
    );
  }
}
