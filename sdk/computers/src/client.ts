/**
 * Framework-free client for the Allternit Computers API.
 *
 * Covers the route surface in `cmd/allternit-api/src/computer_routes.rs`
 * (mounted at /api/v1/computers), the file/control surface in
 * `cmd/allternit-api/src/bot_desktop_input.rs`, snapshots in
 * `cmd/allternit-api/src/bot_desktop_snapshots.rs`, and the Phase 4 desktop
 * template registry in `cmd/allternit-api/src/bot_desktop_templates.rs`
 * (mounted at /api/v1/desktop-templates).
 *
 * Risky calls accept an optional `approvalId`, threaded verbatim as the
 * `?approval_id=` query param (the server-side serde field is
 * `approval_id`, with `approvalId` accepted as an alias). This client never
 * obtains approvals itself — the caller must already hold a grant from the
 * ACI approvals flow and pass it through.
 */

import type {
  BuildTemplateResponse,
  Computer,
  ComputerEmbedTokenResponse,
  ComputerKeyboardInput,
  ComputerLifecycleResponse,
  ComputerMouseInput,
  ComputerShellInput,
  ComputerShellResponse,
  ComputerSnapshot,
  ComputerSnapshotActionResponse,
  ComputerStatusReport,
  ComputerTemplateSpec,
  CreateComputerInput,
  CreateComputerResponse,
  DesktopTemplate,
  ListComputersFilters,
  ListDesktopTemplatesFilters,
  ResizeComputerInput,
  ResizeComputerResponse,
  UpdateComputerInput,
} from './types.js';

export interface ComputersClientOptions {
  /** API base URL; defaults to the local gateway http://127.0.0.1:8013. */
  baseUrl?: string;
  /** Bearer token; sent as `Authorization: Bearer <token>` when set. */
  token?: string;
}

export class ComputersApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Computers API returned HTTP ${status}: ${body}`);
    this.name = 'ComputersApiError';
  }
}

const COMPUTERS_PREFIX = '/api/v1/computers';
const TEMPLATES_PREFIX = '/api/v1/desktop-templates';

export class ComputersClient {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: ComputersClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:8013').replace(/\/+$/, '');
    this.token = options.token;
  }

  // ── REST lifecycle ──────────────────────────────────────────────────────

  async listComputers(filters: ListComputersFilters = {}): Promise<Computer[]> {
    const params = new URLSearchParams();
    if (filters.bot_id) params.set('bot_id', filters.bot_id);
    if (filters.kind) params.set('kind', filters.kind);
    if (filters.group_id) params.set('group_id', filters.group_id);
    if (filters.include_roles) params.set('include_roles', '1');
    const query = params.toString();
    const result = await this.request<{ computers: Computer[] }>(
      'GET',
      `${COMPUTERS_PREFIX}${query ? `?${query}` : ''}`,
    );
    return result.computers ?? [];
  }

  async getComputer(id: string): Promise<Computer> {
    return this.request('GET', computerPath(id));
  }

  async createComputer(
    input: CreateComputerInput,
    approvalId?: string,
  ): Promise<CreateComputerResponse> {
    const params = new URLSearchParams();
    if (approvalId) params.set('approval_id', approvalId);
    const query = params.toString();
    return this.request('POST', `${COMPUTERS_PREFIX}${query ? `?${query}` : ''}`, input);
  }

  async startComputer(id: string, approvalId?: string): Promise<ComputerLifecycleResponse> {
    return this.request('POST', computerPath(id, 'start', approvalId));
  }

  async stopComputer(id: string, approvalId?: string): Promise<ComputerLifecycleResponse> {
    return this.request('POST', computerPath(id, 'stop', approvalId));
  }

  async restartComputer(id: string, approvalId?: string): Promise<ComputerLifecycleResponse> {
    return this.request('POST', computerPath(id, 'restart', approvalId));
  }

  async resizeComputer(
    id: string,
    input: ResizeComputerInput,
    approvalId?: string,
  ): Promise<ResizeComputerResponse> {
    return this.request('PATCH', computerPath(id, 'resize', approvalId), input);
  }

  async cloneComputer(
    id: string,
    name?: string,
    approvalId?: string,
  ): Promise<CreateComputerResponse> {
    return this.request('POST', computerPath(id, 'clone', approvalId), { name });
  }

  /** Returns void; the server answers 204 NO_CONTENT. */
  async deleteComputer(id: string, approvalId?: string): Promise<void> {
    await this.request('POST', computerPath(id, 'delete', approvalId), undefined, {
      allowEmpty: true,
    });
  }

  /**
   * PATCH /api/v1/computers/:id — update mutable computer fields. Today the
   * server accepts `idle_timeout_secs` (integer seconds, or null to clear)
   * and re-fetches the computer; rejects creating/deleted computers with 409.
   */
  async updateComputer(id: string, input: UpdateComputerInput): Promise<Computer> {
    return this.request('PATCH', computerPath(id), input);
  }

  /**
   * POST /api/v1/computers/:id/session-end — session-persistence hook: apply
   * the computer's persistence policy (ephemeral/session/persistent) when the
   * owning session ends. Approval-gated like other lifecycle mutations.
   */
  async sessionEnd(id: string, approvalId?: string): Promise<ComputerLifecycleResponse> {
    return this.request('POST', computerPath(id, 'session-end', approvalId));
  }

  // ── Phase 5 additions: status + embed token ─────────────────────────────

  /**
   * GET /api/v1/computers/:id/status (Phase 5 addition — response shape is
   * not yet frozen server-side).
   */
  async getComputerStatus(id: string): Promise<ComputerStatusReport> {
    return this.request('GET', computerPath(id, 'status'));
  }

  /**
   * POST /api/v1/computers/:id/embed-token (Phase 5 addition — response
   * shape is not yet frozen server-side).
   */
  async createEmbedToken(id: string): Promise<ComputerEmbedTokenResponse> {
    return this.request('POST', computerPath(id, 'embed-token'));
  }

  // ── Desktop control ─────────────────────────────────────────────────────

  /** GET /api/v1/computers/:id/screenshot → PNG bytes. */
  async screenshot(id: string): Promise<Blob> {
    const response = await this.raw(computerPath(id, 'screenshot'));
    return response.blob();
  }

  async sendMouse(
    id: string,
    input: ComputerMouseInput,
    approvalId?: string,
  ): Promise<{ success: boolean }> {
    return this.request('POST', computerPath(id, 'mouse', approvalId), input);
  }

  async sendKeyboard(
    id: string,
    input: ComputerKeyboardInput,
    approvalId?: string,
  ): Promise<{ success: boolean }> {
    return this.request('POST', computerPath(id, 'keyboard', approvalId), input);
  }

  async runShell(
    id: string,
    input: ComputerShellInput,
    approvalId?: string,
  ): Promise<ComputerShellResponse> {
    return this.request('POST', computerPath(id, 'shell', approvalId), input);
  }

  /**
   * POST /api/v1/computers/:id/files/upload?path=... — raw body bytes with
   * Content-Type: application/octet-stream.
   */
  async uploadFile(
    id: string,
    path: string,
    bytes: Blob | ArrayBuffer | Uint8Array,
    approvalId?: string,
  ): Promise<{ success: boolean }> {
    const response = await this.raw(computerPath(id, 'files/upload', approvalId, path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: toBodyInit(bytes),
    });
    return (await response.json()) as { success: boolean };
  }

  /** GET /api/v1/computers/:id/files/download?path=... → file bytes. */
  async downloadFile(id: string, path: string): Promise<Blob> {
    const response = await this.raw(computerPath(id, 'files/download', undefined, path));
    return response.blob();
  }

  // ── Snapshots ───────────────────────────────────────────────────────────

  async listSnapshots(id: string): Promise<ComputerSnapshot[]> {
    const result = await this.request<{ snapshots: ComputerSnapshot[] }>(
      'GET',
      computerPath(id, 'snapshots'),
    );
    return result.snapshots;
  }

  async createSnapshot(
    id: string,
    stateful = false,
  ): Promise<ComputerSnapshotActionResponse> {
    return this.request('POST', computerPath(id, 'snapshots'), { stateful });
  }

  async restoreSnapshot(
    id: string,
    snapshotId: string,
  ): Promise<ComputerSnapshotActionResponse> {
    return this.request(
      'POST',
      computerPath(id, `snapshots/${encodeURIComponent(snapshotId)}/restore`),
    );
  }

  async deleteSnapshot(
    id: string,
    snapshotId: string,
  ): Promise<ComputerSnapshotActionResponse> {
    return this.request(
      'DELETE',
      computerPath(id, `snapshots/${encodeURIComponent(snapshotId)}`),
    );
  }

  // ── Desktop templates (Phase 4 registry) ────────────────────────────────

  async listTemplates(filters: ListDesktopTemplatesFilters = {}): Promise<DesktopTemplate[]> {
    const params = new URLSearchParams();
    if (filters.os) params.set('os', filters.os);
    if (filters.tag) params.set('tag', filters.tag);
    const query = params.toString();
    const result = await this.request<{ templates: DesktopTemplate[] }>(
      'GET',
      `${TEMPLATES_PREFIX}${query ? `?${query}` : ''}`,
    );
    return result.templates ?? [];
  }

  /**
   * GET /api/v1/desktop-templates/:id — fetch one template row (including its
   * resolved view fields and golden-build status).
   */
  async getTemplate(id: string): Promise<DesktopTemplate> {
    return this.request('GET', `${TEMPLATES_PREFIX}/${encodeURIComponent(id)}`);
  }

  /**
   * POST /api/v1/desktop-templates/import — create/replace-by-name from a
   * canonical `apiVersion: allternit.ai/v1` `ComputerTemplate` doc. Accepts
   * the spec object (serialized as JSON, which the server's YAML deserializer
   * also parses) or a pre-serialized YAML/JSON string.
   */
  async importTemplate(doc: ComputerTemplateSpec | string): Promise<DesktopTemplate> {
    return this.request('POST', `${TEMPLATES_PREFIX}/import`, doc, {
      rawBody: typeof doc === 'string',
    });
  }

  /**
   * POST /api/v1/desktop-templates/:id/build — async golden-snapshot build
   * (202 immediately; poll build_status). Build start is ACI-approval-gated
   * like other risky computer actions.
   */
  async buildTemplate(id: string, approvalId?: string): Promise<BuildTemplateResponse> {
    const params = new URLSearchParams();
    if (approvalId) params.set('approval_id', approvalId);
    const query = params.toString();
    return this.request(
      'POST',
      `${TEMPLATES_PREFIX}/${encodeURIComponent(id)}/build${query ? `?${query}` : ''}`,
    );
  }

  // ── HTTP plumbing ───────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { allowEmpty?: boolean; rawBody?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (options.rawBody && typeof body === 'string') {
        payload = body;
        headers['Content-Type'] = 'application/json';
      } else {
        payload = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
      }
    }
    const response = await this.raw(path, { method, headers, body: payload });
    if (options.allowEmpty || response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  private async raw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Accept', headers.get('Accept') ?? 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new ComputersApiError(response.status, await response.text());
    }
    return response;
  }
}

function computerPath(id: string, suffix = '', approvalId?: string, path?: string): string {
  const params = new URLSearchParams();
  if (approvalId) params.set('approval_id', approvalId);
  if (path !== undefined) params.set('path', path);
  const query = params.toString();
  const base = id === '' ? COMPUTERS_PREFIX : `${COMPUTERS_PREFIX}/${encodeURIComponent(id)}`;
  return `${base}${suffix ? `/${suffix}` : ''}${query ? `?${query}` : ''}`;
}

function toBodyInit(bytes: Blob | ArrayBuffer | Uint8Array): BodyInit {
  if (bytes instanceof Blob || bytes instanceof ArrayBuffer) return bytes;
  return bytes.slice().buffer as ArrayBuffer;
}
