/**
 * Docmost → Allternit Service Adapter
 * Connects the public AGPL Docmost fork to Allternit via REST API.
 *
 * This adapter lives in the private Allternit monorepo but ONLY talks
 * to Docmost over HTTP. It never imports AGPL source code.
 */

import type { AllternitArtifact, AllternitArtifactSection } from '@/lib/artifacts/schema';

interface DocmostPageRaw {
  id: string;
  spaceId: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocmostConfig {
  baseUrl: string;
  apiToken?: string;
}

export class DocmostAdapter {
  constructor(private config: DocmostConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`;
    }

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
    });

    if (!res.ok) throw new Error(`Docmost API error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  async listPages(spaceId: string): Promise<AllternitArtifact[]> {
    const data = await this.request<{ pages: Array<{ id: string; title: string; slug: string; createdAt: string; updatedAt: string }> }>(
      `/api/spaces/${spaceId}/pages`
    );
    return data.pages.map((p) => ({
      id: p.id,
      workspaceId: spaceId,
      title: p.title,
      type: 'document' as const,
      status: 'active' as const,
      tags: ['docmost'],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      sections: [],
      revisions: [],
      forkMeta: { docmost: { pageId: p.id, spaceId } },
    }));
  }

  async getPage(pageId: string): Promise<AllternitArtifact> {
    const page = await this.request<DocmostPageRaw>(`/api/pages/${pageId}`);

    // Lazy-load the adapter to avoid pulling AGPL logic into the main bundle
    const { docmostAdapter } = await import('@/lib/artifacts/adapters/docmost.adapter');
    return docmostAdapter.toAllternit(page);
  }

  async getPageRaw(pageId: string): Promise<DocmostPageRaw> {
    return this.request<DocmostPageRaw>(`/api/pages/${pageId}`);
  }

  async createPage(spaceId: string, title: string, parentPageId?: string): Promise<AllternitArtifact> {
    const page = await this.request<DocmostPageRaw>(`/api/pages`, {
      method: 'POST',
      body: JSON.stringify({ spaceId, title, parentPageId: parentPageId ?? null, content: {} }),
    });

    const { docmostAdapter } = await import('@/lib/artifacts/adapters/docmost.adapter');
    return docmostAdapter.toAllternit(page);
  }

  async updatePage(pageId: string, updates: { title?: string; content?: Record<string, unknown> }): Promise<AllternitArtifact> {
    const page = await this.request<DocmostPageRaw>(`/api/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    const { docmostAdapter } = await import('@/lib/artifacts/adapters/docmost.adapter');
    return docmostAdapter.toAllternit(page);
  }

  async deletePage(pageId: string): Promise<void> {
    await this.request<void>(`/api/pages/${pageId}`, {
      method: 'DELETE',
    });
  }

  async getRevisions(pageId: string): Promise<AllternitArtifact['revisions']> {
    const data = await this.request<{ revisions: Array<{ id: string; createdAt: string; createdBy: { name: string }; data: Record<string, unknown> }> }>(
      `/api/pages/${pageId}/revisions`
    );

    return data.revisions.map((r) => ({
      id: r.id,
      artifactId: pageId,
      createdAt: r.createdAt,
      reason: `Edited by ${r.createdBy.name}`,
      snapshot: {
        title: '',
        type: 'document',
        status: 'active',
        tags: [],
        sections: [],
        updatedAt: r.createdAt,
      },
    }));
  }
}
