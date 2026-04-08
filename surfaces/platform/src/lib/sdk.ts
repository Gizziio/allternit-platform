/**
 * Allternit SDK - Typed HTTP client for the Allternit platform REST API.
 * Extracted from the private @allternit/sdk package.
 */

export interface AllternitClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export interface SessionInfo {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface PermissionReply {
  granted: boolean;
  reason?: string;
}

export interface QuestionReply {
  question: string;
  options?: string[];
  answered?: boolean;
}

class AllternitClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(options: AllternitClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3013';
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // Permission/reply API
  public permission = {
    reply: async (sessionId: string, data: unknown): Promise<PermissionReply> => {
      return this.request(`/api/v1/sessions/${sessionId}/permission`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  // Question API
  public question = {
    reply: async (sessionId: string, answer: string): Promise<QuestionReply> => {
      return this.request(`/api/v1/sessions/${sessionId}/question/reply`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
    },
    reject: async (sessionId: string): Promise<void> => {
      return this.request(`/api/v1/sessions/${sessionId}/question/reject`, {
        method: 'POST',
      });
    },
  };

  // Session API
  public sessions = {
    list: async (): Promise<SessionInfo[]> => {
      return this.request('/api/v1/sessions');
    },
    get: async (id: string): Promise<SessionInfo> => {
      return this.request(`/api/v1/sessions/${id}`);
    },
    create: async (data: Partial<SessionInfo>): Promise<SessionInfo> => {
      return this.request('/api/v1/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };
}

export function createAllternitClient(options?: AllternitClientOptions): AllternitClient {
  return new AllternitClient(options);
}

export { AllternitClient };
