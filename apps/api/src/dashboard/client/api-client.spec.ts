import { normalizeApiError, renderClientApiScript } from './api-client';

describe('dashboard client API', () => {
  it('normalizes payload errors without touching the response shape', () => {
    expect(normalizeApiError({ message: '入力が不正です' })).toBe('入力が不正です');
    expect(normalizeApiError({ error: { message: '権限がありません' } })).toBe('権限がありません');
    expect(normalizeApiError({})).toBe('APIエラー');
  });

  it('exposes a browser API wrapper and keeps failure behavior testable', async () => {
    const script = renderClientApiScript();
    const fakeWindow = { location: { pathname: '/', search: '', href: '' } };
    const fakeFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: '入力が不正です' }) });
    const api = new Function('window', 'fetch', script + '; return window.SalesAiApi;')(fakeWindow, fakeFetch);

    expect(script).toContain('global.SalesAiApi');
    expect(script).toContain("'X-CSRF-Token': csrfToken");
    expect(script).not.toContain('X-Operator-Email');
    await expect(api.request('/api/test')).rejects.toThrow('入力が不正です');
    await expect(api.request('/api/test', {}, { errorMode: 'http' })).rejects.toThrow('HTTP 422');
  });

  it('loads the CSRF token before a mutating request', async () => {
    const script = renderClientApiScript();
    const fakeWindow = { location: { pathname: '/leads-view', search: '', href: '' } };
    const calls: Array<{ path: string; options: Record<string, unknown> }> = [];
    const fakeFetch = async (path: string, options: Record<string, unknown> = {}) => {
      calls.push({ path, options });
      if (path === '/api/auth/me') {
        return { ok: true, status: 200, json: async () => ({ data: { csrfToken: 'csrf-test' } }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: { saved: true } }) };
    };
    const api = new Function('window', 'fetch', script + '; return window.SalesAiApi;')(fakeWindow, fakeFetch);

    await expect(api.request('/api/leads/1', { method: 'PATCH', body: '{}' })).resolves.toEqual({ saved: true });
    expect(calls.map((call) => call.path)).toEqual(['/api/auth/me', '/api/leads/1']);
    expect((calls[1].options.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test');
  });
});
