/**
 * Allternit AI Backend Adapter
 * Connects the forked Allternit AI backend to the Allternit platform.
 *
 * Strategy: The upstream Svelte frontend was stripped entirely.
 * All traffic is proxied through this adapter.
 */

import type { AllternitArtifact } from '@/lib/artifacts/schema';

export interface AllternitAIConfig {
  baseUrl: string;
  apiKey?: string;
}

export class AllternitAIAdapter {
  constructor(private config: AllternitAIConfig) {
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
    });

    if (!res.ok) throw new Error(`Allternit AI error: ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }

  async chatCompletion(messages: Array<{ role: string; content: string }>, model = 'gpt-4') {
    return this.request<{ choices: Array<{ message: { content: string } }> }>('/api/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model, messages }),
    });
  }

  async uploadDocument(file: File): Promise<{ id: string; collection_name: string }> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${this.config.baseUrl}/api/v1/documents/`, {
      method: 'POST',
      headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      body: form,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return (await res.json()) as { id: string; collection_name: string };
  }

  async queryRag(query: string, collectionName?: string): Promise<string> {
    const res = await this.request<{
      data: Array<{ content: string; source: string }>;
    }>('/api/v1/retrieval/query', {
      method: 'POST',
      body: JSON.stringify({ query, collection_name: collectionName }),
    });

    return res.data.map((d) => d.content).join('\n---\n');
  }

  async listArtifacts(): Promise<AllternitArtifact[]> {
    // The Allternit AI backend stores artifacts in its own DB; map them to Allternit shape
    const data = await this.request<Array<{
      id: string;
      title: string;
      content: string;
      type: string;
      created_at: string;
      updated_at: string;
    }>>('/api/v1/artifacts/');

    return data.map((a) => ({
      id: a.id,
      workspaceId: 'allternit-ai',
      title: a.title,
      type: (a.type as any) ?? 'document',
      status: 'active' as const,
      tags: ['allternit-ai', a.type],
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      sections: [
        {
          id: `${a.id}-s1`,
          artifactId: a.id,
          heading: a.title,
          kind: 'document/html' as const,
          body: a.content,
          position: 0,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        },
      ],
      revisions: [],
      forkMeta: {
        allternitAi: {
          artifactId: a.id,
        },
      },
    }));
  }
}
