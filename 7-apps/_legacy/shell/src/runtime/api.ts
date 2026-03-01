import { convertKeysToCamelCase, convertKeysToSnakeCase } from '../../../ui/src/a2ui/type-adapter';

export const KERNEL_API_BASE = '/api/v1';
export const TERMINAL_API_BASE = '/api/terminal';

type RequestOptions = {
  snakeCase?: boolean;
  convertResponse?: boolean;
  method?: 'POST' | 'PUT' | 'PATCH';
};

const buildHeaders = (headers?: HeadersInit): HeadersInit => {
  const auth_token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  const baseHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (auth_token) {
    baseHeaders['Authorization'] = `Bearer ${auth_token}`;
  }

  return {
    ...baseHeaders,
    ...headers,
  };
};

const parseJson = async <T>(response: Response, convertResponse: boolean): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  const data = JSON.parse(text) as unknown;
  return convertResponse ? convertKeysToCamelCase<T>(data) : (data as T);
};

export const getJson = async <T>(url: string, options: RequestOptions & { headers?: HeadersInit } = {}): Promise<T> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: options.headers || buildHeaders()
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return parseJson<T>(response, options.convertResponse !== false);
};

export const postJson = async <T, B = unknown>(
  url: string,
  body: B,
  options: RequestOptions & { headers?: HeadersInit } = {}
): Promise<T> => {
  const payload = options.snakeCase ? convertKeysToSnakeCase(body) : body;
  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers: options.headers || buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return parseJson<T>(response, options.convertResponse !== false);
};

export const deleteJson = async (url: string): Promise<void> => {
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
};

export const buildWsUrl = (path: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}${path}`;
};
