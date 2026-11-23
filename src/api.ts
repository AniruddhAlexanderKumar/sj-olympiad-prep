export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function fallbackErrorMessage(status: number, path: string) {
  const isGuestStartRequest = path === '/auth/guest';
  const isAccountRequest = path.startsWith('/auth/') && !isGuestStartRequest;
  if (status === 404) {
    if (isGuestStartRequest) return 'The journey starter could not be found. Refresh the page and try again.';
    return isAccountRequest
      ? 'The account service could not be found. Refresh the page and try again; if it persists, check the app’s API connection.'
      : 'That service endpoint could not be found. Refresh the app and try again.';
  }
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if ([502, 503, 504].includes(status)) return 'The service is temporarily unavailable. Please try again shortly.';
  if (status >= 500) return 'The service ran into a problem. Please try again. If your journey may have started, refresh the page to continue.';
  if (status === 400) return 'The server could not accept those details. Check the fields and try again.';
  return `The request failed with status ${status}. Please check the details and try again.`;
}

function unexpectedResponseMessage(path: string) {
  if (path === '/auth/guest') return 'The journey service returned an unexpected response. Refresh the page and try again.';
  return path.startsWith('/auth/')
    ? 'The account service returned an unexpected response. Refresh the page and try again.'
    : 'The service returned an unexpected response. Refresh the app and try again.';
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' });
  } catch (error) {
    if (error instanceof TypeError) {
      const isGuestStartRequest = path === '/auth/guest';
      const isAccountRequest = path.startsWith('/auth/') && !isGuestStartRequest;
      throw new ApiError(
        isGuestStartRequest
          ? 'We could not start your journey. Check your connection and try again.'
          : isAccountRequest
            ? 'We could not reach the account service. Check your connection and try again; your entries are still here.'
            : 'We could not reach the service. Check your connection and try again.',
        0,
        'network_error',
      );
    }
    throw error;
  }

  const text = await response.text();
  let body: unknown;
  let isJson = false;
  if (text.trim()) {
    try {
      body = JSON.parse(text);
      isJson = true;
    } catch { /* Some proxies return HTML or plain text for API errors. */ }
  }
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : undefined;

  if (!response.ok) {
    const message = typeof record?.error === 'string' && record.error.trim()
      ? record.error
      : fallbackErrorMessage(response.status, path);
    const code = typeof record?.code === 'string' && record.code.trim()
      ? record.code
      : response.status === 404 ? 'api_not_found' : `http_${response.status}`;
    throw new ApiError(message, response.status, code);
  }

  if (!text.trim() && response.status === 204) return null as T;
  if (!isJson) throw new ApiError(unexpectedResponseMessage(path), response.status, 'unexpected_response');
  return body as T;
}

export const postJson = (path: string, body: unknown) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const patchJson = (path: string, body: unknown) => api(path, { method: 'PATCH', body: JSON.stringify(body) });
