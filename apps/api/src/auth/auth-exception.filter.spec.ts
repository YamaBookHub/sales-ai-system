import { AuthExceptionFilter } from './auth-exception.filter';
import { AuthenticationRequiredException, CsrfValidationException } from './auth.exceptions';

describe('AuthExceptionFilter', () => {
  function setup(path: string) {
    const response = {
      redirect: jest.fn(),
      status: jest.fn(),
      type: jest.fn(),
      send: jest.fn(),
      json: jest.fn()
    };
    response.status.mockReturnValue(response);
    response.type.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: path }),
        getResponse: () => response
      })
    };
    return { response, host };
  }

  it('redirects every protected HTML workspace to login when unauthenticated', () => {
    const filter = new AuthExceptionFilter();
    for (const path of ['/', '/leads-view', '/mail-workspace', '/today', '/sales-performance', '/replies']) {
      const { response, host } = setup(path);
      filter.catch(new AuthenticationRequiredException(), host as any);
      expect(response.redirect).toHaveBeenCalledWith(302, `/login?returnTo=${encodeURIComponent(path)}`);
    }
  });

  it('returns the existing API envelope for authentication and CSRF failures', () => {
    const filter = new AuthExceptionFilter();
    const unauthenticated = setup('/api/leads');
    filter.catch(new AuthenticationRequiredException(), unauthenticated.host as any);
    expect(unauthenticated.response.status).toHaveBeenCalledWith(401);
    expect(unauthenticated.response.json).toHaveBeenCalledWith({
      data: null,
      meta: null,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'ログインしてください。' }
    });

    const csrf = setup('/api/leads/lead-1');
    filter.catch(new CsrfValidationException(), csrf.host as any);
    expect(csrf.response.status).toHaveBeenCalledWith(403);
    expect(csrf.response.json).toHaveBeenCalledWith({
      data: null,
      meta: null,
      error: { code: 'CSRF_VALIDATION_FAILED', message: 'リクエストを確認できませんでした。' }
    });
  });
});
