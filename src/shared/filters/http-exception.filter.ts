import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ERROR_MESSAGES, KNOWN_ERROR_CODES } from '@src/shared/constants/error-codes';
import type { Response } from 'express';

/** Shape NestJS / class-validator sends for HTTP exceptions */
interface HttpExceptionBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

function extractErrorCode(body: HttpExceptionBody): string {
  const messages: string[] = Array.isArray(body.message)
    ? body.message
    : body.message !== undefined
      ? [body.message]
      : [];

  const hasLimitMessage = messages.some((m) =>
    m.toLowerCase().includes('must not be greater than 100'),
  );
  if (hasLimitMessage) return 'LIMIT_EXCEEDED';

  return body.error ?? 'VALIDATION_ERROR';
}

function extractFirstMessage(body: HttpExceptionBody): string {
  if (Array.isArray(body.message) && body.message.length > 0) {
    return body.message[0];
  }
  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  return 'Bad Request';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as HttpExceptionBody;

      const errorCode = extractErrorCode(body);
      const message = extractFirstMessage(body);

      res.status(status).json({ statusCode: status, error: errorCode, message });
      return;
    }

    if (exception instanceof Error && KNOWN_ERROR_CODES.has(exception.message)) {
      const code = exception.message;
      res.status(400).json({
        statusCode: 400,
        error: code,
        message: ERROR_MESSAGES[code],
      });
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(500).json({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
}
