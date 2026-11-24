/**
 * Read the backend's typed error (`{ code, details }`) from an RTK Query error.
 */

export interface ApiErrorInfo {
  status?: number | string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Normalise any thrown RTK Query error (or `.unwrap()` rejection) into `{ code, details }`. */
export function getApiError(error: unknown): ApiErrorInfo {
  if (!isRecord(error)) return {};
  const status =
    typeof error.status === 'number' || typeof error.status === 'string' ? error.status : undefined;
  const data = isRecord(error.data) ? error.data : {};
  // Backend envelope: { success: false, error: { code, message, details } } or flat { code, ... }
  const body = isRecord(data.error) ? data.error : data;
  return {
    status,
    code: typeof body.code === 'string' ? body.code : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
    details: isRecord(body.details) ? body.details : undefined,
  };
}

export function hasApiErrorCode(error: unknown, code: string): boolean {
  return getApiError(error).code === code;
}
