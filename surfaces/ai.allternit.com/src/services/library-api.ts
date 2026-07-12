import { useEffect, useState } from 'react';

export type LibraryItemKind = 'image' | 'document' | 'code' | 'artifact' | 'file';

export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  url?: string;
  content?: string;
  session_id: string;
  canvas_id: string;
  origin: 'generated' | 'uploaded';
  created_at: string;
}

export interface LibraryListResponse {
  items: LibraryItem[];
  next_cursor: string | null;
  total: number;
}

export interface LibraryStats {
  image: number;
  document: number;
  code: number;
  artifact: number;
  file: number;
  total: number;
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchLibraryItems(
  filters: {
    kind?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {},
  signal?: AbortSignal
): Promise<LibraryListResponse> {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.search) params.set('search', filters.search);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  if (filters.cursor) params.set('cursor', filters.cursor);
  const query = params.toString();
  const response = await fetch(`/api/v1/library${query ? `?${query}` : ''}`, { signal });
  const payload = await readJson<Partial<LibraryListResponse>>(response, 'Failed to load library');
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    next_cursor: payload.next_cursor ?? null,
    total: typeof payload.total === 'number' ? payload.total : 0,
  };
}

export async function fetchLibraryStats(signal?: AbortSignal): Promise<LibraryStats> {
  const response = await fetch('/api/v1/library/stats', { signal });
  const payload = await readJson<{ stats?: Partial<LibraryStats> }>(response, 'Failed to load library stats');
  const stats = payload.stats ?? {};
  return {
    image: stats.image ?? 0,
    document: stats.document ?? 0,
    code: stats.code ?? 0,
    artifact: stats.artifact ?? 0,
    file: stats.file ?? 0,
    total: stats.total ?? 0,
  };
}

/**
 * Resolve an authenticated, same-origin `/api/...` URL into a blob object URL
 * so it can be used by `<img>`/`<a>` (which don't send our auth headers).
 * Non-`/api/` URLs (e.g. `data:` or `https:`) are passed through unchanged.
 * The created object URL is revoked on unmount / URL change.
 */
export function useAuthBlobUrl(url: string | undefined): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setBlobUrl(undefined);
      return;
    }
    if (!url.startsWith('/api/')) {
      setBlobUrl(url);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;
    fetch(url, { credentials: 'include' })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(undefined);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return blobUrl;
}
