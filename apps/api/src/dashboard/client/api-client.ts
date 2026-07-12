export interface ClientApiConfig {
  includeOperatorEmail?: boolean;
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
    '  global.SalesAiApi = {',
    '    normalizeApiError,',
    '    async request(path, options = {}, config = {}) {',
    '      const includeOperatorEmail = config.includeOperatorEmail === true;',
    '      const unwrapData = config.unwrapData !== false;',
    "      const errorMode = config.errorMode || 'payload';",
    "      const operatorEmail = includeOperatorEmail ? global.localStorage.getItem('salesAiSystem.operatorEmail') || '' : '';",
    "      const response = await fetch(path, {",
    '        ...options,',
    "        headers: { 'Content-Type': 'application/json', ...(operatorEmail ? { 'X-Operator-Email': operatorEmail } : {}), ...(options.headers || {}) }",
    '      });',
    '      const payload = await response.json().catch(() => ({}));',
    "      if (!response.ok) throw new Error(errorMode === 'http' ? 'HTTP ' + response.status : normalizeApiError(payload));",
    '      return unwrapData ? payload.data : payload;',
    '    }',
    '  };',
    '})(window);'
  ].join('\n');
}
