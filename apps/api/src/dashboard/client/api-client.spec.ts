import { normalizeApiError, renderClientApiScript } from './api-client';

describe('dashboard client API', () => {
  it('normalizes payload errors without touching the response shape', () => {
    expect(normalizeApiError({ message: '入力が不正です' })).toBe('入力が不正です');
    expect(normalizeApiError({ error: { message: '権限がありません' } })).toBe('権限がありません');
    expect(normalizeApiError({})).toBe('APIエラー');
  });

  it('exposes a browser API wrapper and keeps failure behavior testable', async () => {
    const script = renderClientApiScript();
    const fakeWindow = { localStorage: { getItem: () => 'operator@example.com' } };
    const fakeFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: '入力が不正です' }) });
    const api = new Function('window', 'fetch', script + '; return window.SalesAiApi;')(fakeWindow, fakeFetch);

    expect(script).toContain('global.SalesAiApi');
    await expect(api.request('/api/test', {}, { includeOperatorEmail: true })).rejects.toThrow('入力が不正です');
    await expect(api.request('/api/test', {}, { errorMode: 'http' })).rejects.toThrow('HTTP 422');
  });
});
