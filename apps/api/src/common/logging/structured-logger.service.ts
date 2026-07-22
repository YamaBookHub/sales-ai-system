import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

export type StructuredLogFields = {
  userId?: string;
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  operation?: string;
  source?: string;
  provider?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  error?: unknown;
};

type LogLevel = 'info' | 'warn' | 'error';

@Injectable()
export class StructuredLogger implements LoggerService {
  constructor(private readonly requestContext: RequestContextService) {}

  infoEvent(event: string, fields: StructuredLogFields = {}): void {
    this.write('info', event, fields);
  }

  warnEvent(event: string, fields: StructuredLogFields = {}): void {
    this.write('warn', event, fields);
  }

  errorEvent(event: string, fields: StructuredLogFields = {}): void {
    this.write('error', event, fields);
  }

  log(_message: unknown, context?: string): void {
    this.infoEvent('framework.log', { operation: safeToken(context) });
  }

  warn(_message: unknown, context?: string): void {
    this.warnEvent('framework.warning', { operation: safeToken(context) });
  }

  error(message: unknown, _trace?: string, context?: string): void {
    this.errorEvent('framework.error', { operation: safeToken(context), error: message });
  }

  debug(_message: unknown, context?: string): void {
    this.infoEvent('framework.debug', { operation: safeToken(context) });
  }

  verbose(_message: unknown, context?: string): void {
    this.infoEvent('framework.verbose', { operation: safeToken(context) });
  }

  fatal(message: unknown, context?: string): void {
    this.errorEvent('framework.fatal', { operation: safeToken(context), error: message });
  }

  private write(level: LogLevel, event: string, fields: StructuredLogFields): void {
    const context = this.requestContext.current();
    const error = errorMetadata(fields.error);
    const metadata = compact({
      operation: safeToken(fields.operation),
      source: safeToken(fields.source),
      provider: safeToken(fields.provider),
      method: safeMethod(fields.method),
      route: safeRoute(fields.route),
      statusCode: safeNumber(fields.statusCode),
      durationMs: safeNumber(fields.durationMs),
      ...error
    });
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: context?.requestId || null,
      userId: safeId(fields.userId) || context?.userId || null,
      organizationId: safeId(fields.organizationId) || context?.organizationId || null,
      event: safeToken(event) || 'unknown',
      entityType: safeToken(fields.entityType) || null,
      entityId: safeId(fields.entityId) || null,
      metadata
    };
    const line = `${JSON.stringify(entry)}\n`;
    (level === 'info' ? process.stdout : process.stderr).write(line);
  }
}

function errorMetadata(error: unknown): Record<string, string | number> {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return {};
  const value = error as { code?: unknown; getStatus?: () => unknown };
  const status = typeof value.getStatus === 'function' ? value.getStatus() : undefined;
  return compact({
    errorType: safeErrorType(error, status),
    errorCode: safeErrorCode(value.code),
    errorStatus: safeNumber(status)
  });
}

function safeErrorType(error: unknown, status: unknown): string {
  if (typeof status === 'number') return 'HttpException';
  if (error instanceof TypeError) return 'TypeError';
  if (error instanceof RangeError) return 'RangeError';
  if (error instanceof SyntaxError) return 'SyntaxError';
  if (error instanceof Error) return 'Error';
  return 'UnknownError';
}

function safeErrorCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return SAFE_ERROR_CODES.has(normalized) ? normalized : undefined;
}

const SAFE_ERROR_CODES = new Set([
  'ABORT_ERR',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ETIMEDOUT',
  'P2002',
  'P2025'
]);

function safeId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(trimmed) ? trimmed : undefined;
}

function safeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_.:/-]{1,128}$/.test(trimmed) ? trimmed : undefined;
}

function safeMethod(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const method = value.toUpperCase();
  return /^[A-Z]{3,10}$/.test(method) ? method : undefined;
}

function safeRoute(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('?')) return undefined;
  return value.length <= 200 && !/[\s@]/.test(value) ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): Record<string, Exclude<T[keyof T], undefined>> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Record<string, Exclude<T[keyof T], undefined>>;
}
