export interface ApiClientOptions {
  apiUrl: string;
  token?: string;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.options.apiUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.options.token ? { authorization: `Bearer ${this.options.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = (payload as { message?: string; error?: string }).message
        ?? (payload as { error?: string }).error
        ?? `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return payload;
  }
}
