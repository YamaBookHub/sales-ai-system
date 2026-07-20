import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import {
  AuthenticationRequiredException,
  AuthorizationDeniedException,
  CsrfValidationException,
  InactiveUserException
} from './auth.exceptions';

type RequestLike = { originalUrl?: string; url?: string };
type ResponseLike = {
  redirect: (status: number, location: string) => void;
  status: (status: number) => ResponseLike;
  type: (contentType: string) => ResponseLike;
  send: (body: unknown) => void;
  json: (body: unknown) => void;
};

const HTML_ROUTES = new Set(['/', '/leads-view', '/mail-workspace', '/today', '/sales-performance', '/replies']);

@Catch(
  AuthenticationRequiredException,
  InactiveUserException,
  CsrfValidationException,
  AuthorizationDeniedException
)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();
    const path = pathFrom(request.originalUrl || request.url || '/');

    if (exception instanceof AuthenticationRequiredException && HTML_ROUTES.has(path)) {
      response.redirect(302, `/login?returnTo=${encodeURIComponent(path)}`);
      return;
    }

    const status = exception.getStatus();
    const error = normalizeExceptionResponse(exception.getResponse());
    if (HTML_ROUTES.has(path)) {
      response.status(status).type('text/html; charset=utf-8').send(renderAccessError(status, error.message));
      return;
    }
    response.status(status).json({ data: null, meta: null, error });
  }
}

function pathFrom(value: string): string {
  try {
    return new URL(value, 'http://localhost').pathname;
  } catch {
    return value.split('?')[0] || '/';
  }
}

function normalizeExceptionResponse(value: string | object): { code: string; message: string } {
  if (typeof value === 'object' && value) {
    const record = value as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === 'string' ? record.code : 'AUTHENTICATION_FAILED',
      message: typeof record.message === 'string' ? record.message : '認証を確認できませんでした。'
    };
  }
  return { code: 'AUTHENTICATION_FAILED', message: value || '認証を確認できませんでした。' };
}

function renderAccessError(status: number, message: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>アクセスできません</title></head><body><main><h1>アクセスできません</h1><p>${escapeHtml(message)}</p><p><a href="/login">ログイン画面へ戻る</a></p><small>${status}</small></main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character] || character);
}
