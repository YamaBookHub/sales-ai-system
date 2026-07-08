export type ApiResponse<T> = {
  data: T | null;
  meta: Record<string, unknown> | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
};

export function ok<T>(data: T, meta: Record<string, unknown> | null = null): ApiResponse<T> {
  return { data, meta, error: null };
}
