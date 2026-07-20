export interface ClientApiConfig {
  unwrapData?: boolean;
  errorMode?: 'payload' | 'http';
}

export function normalizeApiError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'APIエラー';
  const record = payload as { message?: unknown; error?: { message?: unknown } | unknown };
  if (typeof record.message === 'string' && record.message) return record.message;
  if (record.error && typeof record.error === 'object' && typeof (record.error as { message?: unknown }).message === 'string') {
    return (record.error as { message: string }).message;
  }
  return 'APIエラー';
}

export function renderClientApiScript(): string {
  return [
    '(function (global) {',
    '  const normalizeApiError = ' + normalizeApiError.toString() + ';',
    "  let csrfToken = '';",
    '  let currentUserPromise = null;',
    '  async function loadCurrentUser() {',
    '    if (currentUserPromise) return currentUserPromise;',
    "    currentUserPromise = fetch('/api/auth/me', { credentials: 'same-origin' })",
    '      .then(async (response) => {',
    '        const payload = await response.json().catch(() => ({}));',
    "        if (!response.ok) throw new Error(normalizeApiError(payload));",
    "        csrfToken = payload && payload.data && payload.data.csrfToken || '';",
    '        return payload.data;',
    '      })',
    '      .catch((error) => { currentUserPromise = null; throw error; });',
    '    return currentUserPromise;',
    '  }',
    '  global.SalesAiApi = {',
    '    normalizeApiError,',
    '    loadCurrentUser,',
    '    async request(path, options = {}, config = {}) {',
    '      const unwrapData = config.unwrapData !== false;',
    "      const errorMode = config.errorMode || 'payload';",
    "      const method = String(options.method || 'GET').toUpperCase();",
    "      const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method) && !path.startsWith('/api/auth/local-login');",
    '      if (needsCsrf && !csrfToken) await loadCurrentUser();',
    "      const response = await fetch(path, {",
    '        ...options,',
    "        credentials: 'same-origin',",
    "        headers: { 'Content-Type': 'application/json', ...(needsCsrf && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(options.headers || {}) }",
    '      });',
    '      const payload = await response.json().catch(() => ({}));',
    "      if (response.status === 401 && global.location && !String(global.location.pathname || '').startsWith('/login')) {",
    "        const returnTo = encodeURIComponent(String(global.location.pathname || '/') + String(global.location.search || ''));",
    "        global.location.href = '/login?returnTo=' + returnTo;",
    '      }',
    "      if (!response.ok) throw new Error(errorMode === 'http' ? 'HTTP ' + response.status : normalizeApiError(payload));",
    '      return unwrapData ? payload.data : payload;',
    '    }',
    '  };',
    '})(window);'
  ].join('\n');
}
