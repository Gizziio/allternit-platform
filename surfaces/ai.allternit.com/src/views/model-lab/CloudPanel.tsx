'use client';

import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Plus,
  Warning,
  CheckCircle,
  X,
  PencilSimple,
  Trash,
  ArrowSquareOut,
  Plugs,
  PlugsConnected,
} from '@phosphor-icons/react';
import { openInBrowser } from '@/lib/openInBrowser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CloudEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  provider?: string;
}

interface EndpointTestResult {
  status: 'success' | 'error';
  message: string;
}

const STORAGE_KEY = 'allternit:model-lab:cloud-endpoints';

function loadEndpoints(): CloudEndpoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is CloudEndpoint =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CloudEndpoint).id === 'string' &&
          typeof (item as CloudEndpoint).name === 'string' &&
          typeof (item as CloudEndpoint).baseUrl === 'string' &&
          typeof (item as CloudEndpoint).apiKey === 'string'
      );
    }
  } catch {
    // Ignore corrupted storage.
  }
  return [];
}

function saveEndpoints(endpoints: CloudEndpoint[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(endpoints));
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export function CloudPanel(): React.ReactNode {
  const [endpoints, setEndpoints] = useState<CloudEndpoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CloudEndpoint | null>(null);

  const [testResults, setTestResults] = useState<Record<string, EndpointTestResult>>({});
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEndpoints(loadEndpoints());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveEndpoints(endpoints);
    }
  }, [endpoints, loaded]);

  const resetForm = () => {
    setName('');
    setBaseUrl('');
    setApiKey('');
    setProvider('');
  };

  const handleAdd = () => {
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim()) return;

    const newEndpoint: CloudEndpoint = {
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      baseUrl: normalizeBaseUrl(baseUrl.trim()),
      apiKey: apiKey.trim(),
      provider: provider.trim() || undefined,
    };

    setEndpoints((prev) => [newEndpoint, ...prev]);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this endpoint?')) return;
    setEndpoints((prev) => prev.filter((endpoint) => endpoint.id !== id));
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const startEdit = (endpoint: CloudEndpoint) => {
    setEditingId(endpoint.id);
    setEditForm({ ...endpoint });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editForm || !editForm.name.trim() || !editForm.baseUrl.trim() || !editForm.apiKey.trim()) {
      return;
    }

    setEndpoints((prev) =>
      prev.map((endpoint) =>
        endpoint.id === editForm.id
          ? {
              ...editForm,
              name: editForm.name.trim(),
              baseUrl: normalizeBaseUrl(editForm.baseUrl.trim()),
              apiKey: editForm.apiKey.trim(),
              provider: editForm.provider?.trim() || undefined,
            }
          : endpoint
      )
    );
    setEditingId(null);
    setEditForm(null);
  };

  const handleTest = async (endpoint: CloudEndpoint) => {
    setTestingIds((prev) => new Set(prev).add(endpoint.id));
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[endpoint.id];
      return next;
    });

    const rootUrl = normalizeBaseUrl(endpoint.baseUrl);
    const candidates = [`${rootUrl}/v1/models`, `${rootUrl}/models`];

    let lastError: string | null = null;
    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${endpoint.apiKey}`,
          },
        });
        if (response.ok) {
          setTestResults((prev) => ({
            ...prev,
            [endpoint.id]: { status: 'success', message: `Reachable via ${url}` },
          }));
          return;
        }
        lastError = `${response.status} ${response.statusText}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Network error';
      }
    }

    setTestResults((prev) => ({
      ...prev,
      [endpoint.id]: { status: 'error', message: lastError ?? 'Unreachable' },
    }));
  };

  const handleOpen = (endpoint: CloudEndpoint) => {
    openInBrowser(normalizeBaseUrl(endpoint.baseUrl));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cloud Deploy</h2>
        <p className="text-sm text-[var(--text-tertiary)]">
          Register and test serverless endpoints for trained models.
        </p>
      </div>

      {/* Add endpoint form */}
      <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add endpoint</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[var(--text-primary)]">Name</Label>
            <Input
              placeholder="Production vLLM"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[var(--text-primary)]">Provider (optional)</Label>
            <Input
              placeholder="vLLM, SGLang, RunPod…"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[var(--text-primary)]">Base URL</Label>
          <Input
            placeholder="https://api.runpod.io/v2/abc-123"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[var(--text-primary)]">API key</Label>
          <Input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleAdd}
            disabled={!name.trim() || !baseUrl.trim() || !apiKey.trim()}
          >
            <Plus size={16} />
            Add endpoint
          </Button>
        </div>
      </div>

      {/* Endpoint list */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Registered endpoints
          {endpoints.length > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">
              ({endpoints.length})
            </span>
          )}
        </h3>

        {endpoints.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]">
            <Cloud size={40} className="mx-auto text-[var(--text-tertiary)] opacity-40 mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No endpoints registered yet.</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-sm mx-auto">
              Add a serverless endpoint above to track deployments and run reachability tests.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {endpoints.map((endpoint) => {
              const isEditing = editingId === endpoint.id;
              const testResult = testResults[endpoint.id];
              const isTesting = testingIds.has(endpoint.id);

              return (
                <div
                  key={endpoint.id}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-4"
                >
                  {isEditing && editForm ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-[var(--text-primary)]">Name</Label>
                          <Input
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                            }
                            className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-[var(--text-primary)]">Provider</Label>
                          <Input
                            value={editForm.provider ?? ''}
                            onChange={(event) =>
                              setEditForm((prev) =>
                                prev ? { ...prev, provider: event.target.value } : prev
                              )
                            }
                            className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-[var(--text-primary)]">Base URL</Label>
                        <Input
                          value={editForm.baseUrl}
                          onChange={(event) =>
                            setEditForm((prev) => (prev ? { ...prev, baseUrl: event.target.value } : prev))
                          }
                          className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-[var(--text-primary)]">API key</Label>
                        <Input
                          type="password"
                          value={editForm.apiKey}
                          onChange={(event) =>
                            setEditForm((prev) => (prev ? { ...prev, apiKey: event.target.value } : prev))
                          }
                          className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          <X size={14} />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          <CheckCircle size={14} />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                            {testResult?.status === 'success' ? (
                              <PlugsConnected size={18} />
                            ) : (
                              <Plugs size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              {endpoint.name}
                            </h4>
                            {endpoint.provider && (
                              <p className="text-xs text-[var(--text-secondary)]">{endpoint.provider}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(endpoint)}
                            title="Edit"
                          >
                            <PencilSimple size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(endpoint.id)}
                            title="Delete"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--text-tertiary)]">Base URL</span>
                          <span className="text-[var(--text-secondary)] truncate max-w-[60%]" title={endpoint.baseUrl}>
                            {endpoint.baseUrl}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--text-tertiary)]">API key</span>
                          <span className="text-[var(--text-secondary)] font-mono">
                            {maskApiKey(endpoint.apiKey)}
                          </span>
                        </div>
                      </div>

                      {testResult && (
                        <div
                          className={`p-2.5 rounded-lg flex items-start gap-2 text-xs ${
                            testResult.status === 'success'
                              ? 'bg-green-500/10 border border-green-500/20'
                              : 'bg-red-500/10 border border-red-500/20'
                          }`}
                        >
                          {testResult.status === 'success' ? (
                            <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <Warning size={14} className="text-red-500 shrink-0 mt-0.5" />
                          )}
                          <span
                            className={
                              testResult.status === 'success' ? 'text-green-600' : 'text-red-500'
                            }
                          >
                            {testResult.message}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleTest(endpoint)}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <span className="animate-pulse">Testing…</span>
                          ) : (
                            <>
                              <Plugs size={14} />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpen(endpoint)}
                        >
                          <ArrowSquareOut size={14} />
                          Open
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default CloudPanel;
