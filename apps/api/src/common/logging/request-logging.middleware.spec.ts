import { EventEmitter } from 'node:events';
import { RequestContextService } from './request-context.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';

describe('RequestLoggingMiddleware', () => {
  const requestId = '11111111-1111-4111-8111-111111111111';

  it('preserves a valid request ID, returns it, and records a 5xx without request data', () => {
    const context = new RequestContextService();
    const logger = { infoEvent: jest.fn(), errorEvent: jest.fn() };
    const middleware = new RequestLoggingMiddleware(context, logger as never);
    const emitter = new EventEmitter();
    const response = {
      statusCode: 503,
      setHeader: jest.fn(),
      once: (event: 'finish', callback: () => void) => emitter.once(event, callback)
    };
    const request = {
      method: 'POST',
      headers: { 'x-request-id': requestId, authorization: 'Bearer secret' },
      route: { path: '/api/projects/search-jobs/:id/cancel' },
      authenticatedPrincipal: { userId: 'user_1', organizationId: 'org_1' }
    };

    middleware.use(request, response, () => emitter.emit('finish'));

    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', requestId);
    expect(logger.errorEvent).toHaveBeenCalledWith('http.request_failed', {
      userId: 'user_1',
      organizationId: 'org_1',
      entityType: 'HttpRequest',
      operation: 'request',
      method: 'POST',
      route: '/api/projects/search-jobs/:id/cancel',
      statusCode: 503,
      durationMs: expect.any(Number)
    });
    expect(logger.infoEvent).not.toHaveBeenCalled();
  });

  it('replaces an untrusted request ID', () => {
    const middleware = new RequestLoggingMiddleware(new RequestContextService(), {
      infoEvent: jest.fn(), errorEvent: jest.fn()
    } as never);
    const emitter = new EventEmitter();
    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
      once: (event: 'finish', callback: () => void) => emitter.once(event, callback)
    };
    const request = { method: 'GET', headers: { 'x-request-id': 'not-a-safe-id\nsecret' }, route: { path: '/' } };

    middleware.use(request, response, () => emitter.emit('finish'));

    const generated = response.setHeader.mock.calls[0][1];
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated).not.toContain('secret');
  });

});
