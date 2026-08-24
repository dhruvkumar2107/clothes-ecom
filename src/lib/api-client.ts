/**
 * Client-side API utilities.
 * All calls include credentials for session cookies.
 */

const API_BASE = '';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed') as Error & {
      code?: string;
      status?: number;
      details?: any;
    };
    error.code = data.code;
    error.status = response.status;
    error.details = data.details;
    throw error;
  }

  return data.data ?? data;
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path;
  return request<T>(url, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(path: string, params?: Record<string, string>, options?: { body?: string }): Promise<T> {
  const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path;
  return request<T>(url, {
    method: 'DELETE',
    body: options?.body,
  });
}

export async function apiPut<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}