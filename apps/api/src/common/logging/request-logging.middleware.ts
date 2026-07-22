import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { StructuredLogger } from './structured-logger.service';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  route?: { path?: unknown };
  authenticatedPrincipal?: { userId?: string; organizationId?: string };
  requestId?: string;
};

type ResponseLike = {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  once: (event: 'finish', callback: () => void) => void;
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger
  ) {}

  use(request: RequestLike, response: ResponseLike, next: () => void): void {
    const requestId = resolveRequestId(request.headers?.['x-request-id']);
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    this.context.run({ requestId }, () => {
      response.once('finish', () => {
        const principal = request.authenticatedPrincipal;
        this.context.setActor(principal);
        const statusCode = response.statusCode || 500;
        const fields = {
          userId: principal?.userId,
          organizationId: principal?.organizationId,
          entityType: 'HttpRequest',
          operation: 'request',
          method: request.method || 'GET',
          route: routeTemplate(request.route?.path),
          statusCode,
          durationMs: Date.now() - startedAt
        };
        if (statusCode >= 500) this.logger.errorEvent('http.request_failed', fields);
        else this.logger.infoEvent('http.request_completed', fields);
      });
      next();
    });
  }
}

function resolveRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isUuid(candidate) ? candidate.toLowerCase() : randomUUID();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function routeTemplate(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') ? value : '/unmatched';
}
