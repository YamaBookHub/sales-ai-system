import { AuthController, safeReturnTo } from './auth.controller';

describe('AuthController login', () => {
  const config = { cookieName: 'sales_ai_session', localLoginEnabled: true };

  function response() {
    const value = {
      setHeader: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn(),
      type: jest.fn(),
      send: jest.fn()
    };
    value.status.mockReturnValue(value);
    value.type.mockReturnValue(value);
    return value;
  }

  it('redirects an already authenticated user to the safe requested workspace', async () => {
    const auth = {
      getConfig: jest.fn().mockReturnValue(config),
      authenticate: jest.fn().mockResolvedValue({ principal: { userId: 'user-1' } })
    };
    const controller = new AuthController(auth as any);
    const res = response();

    await controller.login('/mail-workspace', { headers: { cookie: 'sales_ai_session=opaque' } } as any, res);

    expect(auth.authenticate).toHaveBeenCalledWith('opaque');
    expect(res.redirect).toHaveBeenCalledWith(302, '/mail-workspace');
    expect(res.send).not.toHaveBeenCalled();
  });

  it('shows login when the session is absent or expired', async () => {
    const auth = {
      getConfig: jest.fn().mockReturnValue(config),
      authenticate: jest.fn().mockRejectedValue(new Error('expired'))
    };
    const controller = new AuthController(auth as any);
    const res = response();

    await controller.login('/', { headers: { cookie: 'sales_ai_session=expired' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith('text/html; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('ローカル環境でログイン'));
  });

  it('does not accept an external or unknown return path', () => {
    expect(safeReturnTo('https://evil.example/')).toBe('/');
    expect(safeReturnTo('/unknown')).toBe('/');
    expect(safeReturnTo('/leads-view?page=2')).toBe('/leads-view?page=2');
  });

  it('clears temporary OAuth state and returns a generic login error when Google login is denied', async () => {
    const auth = {
      getConfig: jest.fn().mockReturnValue({ ...config, cookieSecure: false }),
      getRequestMetadata: jest.fn().mockReturnValue({}),
      completeGoogleLogin: jest.fn().mockRejectedValue(new Error('state mismatch'))
    };
    const controller = new AuthController(auth as any);
    const res = response();

    await expect(controller.googleCallback(
      'code',
      'state',
      { headers: { cookie: 'sales_ai_oauth=signed-state' } } as any,
      res
    )).resolves.toEqual({ url: '/login?error=not_authorized', statusCode: 302 });

    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('sales_ai_oauth=')
    );
    expect(res.setHeader.mock.calls[0][1]).toContain('Max-Age=0');
  });

  it('shows only a generic denial message on the login page', async () => {
    const auth = {
      getConfig: jest.fn().mockReturnValue(config),
      authenticate: jest.fn()
    };
    const controller = new AuthController(auth as any);
    const res = response();

    await controller.login('/', { headers: {} } as any, res, 'not_authorized');

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('利用権限を管理者へ確認してください'));
  });
});
