import { RequestContextService } from './request-context.service';
import { StructuredLogger } from './structured-logger.service';

describe('StructuredLogger', () => {
  it('writes request and actor identifiers while dropping arbitrary sensitive fields and error messages', () => {
    const context = new RequestContextService();
    const logger = new StructuredLogger(context);
    const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    context.run({ requestId: '11111111-1111-4111-8111-111111111111', userId: 'user_1' }, () => {
      logger.errorEvent('mail.send_failed', {
        organizationId: 'org_1',
        entityType: 'OutreachEmail',
        entityId: 'mail_1',
        operation: 'send',
        error: Object.assign(new Error('本文 secret-body / test@example.com / 192.168.1.1'), {
          name: 'secret-token',
          code: 'SECRET-TOKEN-123'
        }),
        body: 'secret-body',
        email: 'test@example.com',
        ip: '192.168.1.1',
        token: 'secret-token'
      } as never);
    });

    const line = String(write.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      level: 'error',
      requestId: '11111111-1111-4111-8111-111111111111',
      userId: 'user_1',
      organizationId: 'org_1',
      event: 'mail.send_failed',
      entityType: 'OutreachEmail',
      entityId: 'mail_1',
      metadata: { operation: 'send', errorType: 'Error' }
    });
    expect(line).not.toContain('secret-body');
    expect(line).not.toContain('test@example.com');
    expect(line).not.toContain('192.168.1.1');
    expect(line).not.toContain('secret-token');
    expect(line).not.toContain('SECRET-TOKEN-123');
    write.mockRestore();
  });

  it('allows only known operational error codes', () => {
    const logger = new StructuredLogger(new RequestContextService());
    const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.errorEvent('mail.send_failed', {
      error: Object.assign(new Error('provider failed'), { code: 'ECONNRESET' })
    });

    expect(JSON.parse(String(write.mock.calls[0][0])).metadata).toEqual({
      errorType: 'Error',
      errorCode: 'ECONNRESET'
    });
    write.mockRestore();
  });
});
