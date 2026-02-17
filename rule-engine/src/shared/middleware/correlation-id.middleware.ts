import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware that assigns a correlation ID to every inbound request.
 *
 * Reads from `X-Request-ID` / `X-Correlation-ID` headers (client-provided)
 * or generates a new UUID v4 when absent.
 * The correlation ID is set on both the request and response headers.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();

    // Attach to request for downstream consumption (e.g., pino-http picks it up)
    req.headers['x-request-id'] = correlationId;
    req['id'] = correlationId; // pino-http uses req.id by default

    // Echo back on response so callers can trace
    res.setHeader('X-Request-ID', correlationId);

    next();
  }
}
