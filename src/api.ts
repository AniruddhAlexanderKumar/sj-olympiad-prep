export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin' });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(String(body?.error ?? 'The request could not be completed.'), response.status, String(body?.code ?? 'request_error'));
  }
  return body as T;
}

export const postJson = (path: string, body: unknown) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const patchJson = (path: string, body: unknown) => api(path, { method: 'PATCH', body: JSON.stringify(body) });
