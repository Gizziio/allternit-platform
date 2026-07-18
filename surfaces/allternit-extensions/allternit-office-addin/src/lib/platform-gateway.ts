"use client"

import type { DocumentContext } from './bridge-factory'
import { officeStorage } from './storage'

const DEFAULT_GATEWAY_ORIGIN = 'http://127.0.0.1:8013'
const DEFAULT_PLATFORM_ORIGIN = 'http://localhost:3013'
const GATEWAY_SESSION_ID_KEY = 'allternit-office-gateway-session-id'
const BOOTSTRAP_STATE_KEY = 'allternit-office-bootstrap-state'
const SHELL_MESSAGE_SOURCE = 'allternit-shell'
const ADDIN_MESSAGE_SOURCE = 'allternit-office-addin'
const AUTH_BRIDGE_MESSAGE_SOURCE = 'allternit-office-auth-bridge'
const AUTH_BROADCAST_CHANNEL = 'allternit-office-auth'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getGatewayOrigin(): string {
  return trimTrailingSlash(import.meta.env.VITE_ALLTERNIT_GATEWAY_URL || DEFAULT_GATEWAY_ORIGIN)
}

export function getGatewayApiBaseUrl(): string {
  return `${getGatewayOrigin()}/api/v1`
}

export function getPlatformOrigin(): string {
  if (bootstrapState.platformOrigin) {
    return trimTrailingSlash(bootstrapState.platformOrigin)
  }
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      return trimTrailingSlash(new URL(document.referrer).origin)
    } catch {
      // ignore malformed referrer
    }
  }
  if (import.meta.env.VITE_ALLTERNIT_PLATFORM_URL) {
    return trimTrailingSlash(import.meta.env.VITE_ALLTERNIT_PLATFORM_URL)
  }
  return trimTrailingSlash(DEFAULT_PLATFORM_ORIGIN)
}

export interface OfficeBootstrapAuth {
  token: string | null
  userId: string | null
  email: string | null
  name: string | null
}

export interface OfficeBootstrapContext {
  workspaceId: string | null
  projectId: string | null
  projectName: string | null
}

export interface OfficeBootstrapState {
  auth: OfficeBootstrapAuth
  context: OfficeBootstrapContext
  platformOrigin: string | null
}

const defaultBootstrapState: OfficeBootstrapState = {
  auth: {
    token: null,
    userId: null,
    email: null,
    name: null,
  },
  context: {
    workspaceId: null,
    projectId: null,
    projectName: null,
  },
  platformOrigin: null,
}

let bootstrapState: OfficeBootstrapState = { ...defaultBootstrapState }

function safeParseBootstrapState(value: string | null): OfficeBootstrapState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<OfficeBootstrapState>
    return {
      auth: {
        token: parsed.auth?.token ?? null,
        userId: parsed.auth?.userId ?? null,
        email: parsed.auth?.email ?? null,
        name: parsed.auth?.name ?? null,
      },
      context: {
        workspaceId: parsed.context?.workspaceId ?? null,
        projectId: parsed.context?.projectId ?? null,
        projectName: parsed.context?.projectName ?? null,
      },
      platformOrigin: parsed.platformOrigin ?? null,
    }
  } catch {
    return null
  }
}

function persistBootstrapState(nextState: OfficeBootstrapState): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(BOOTSTRAP_STATE_KEY, JSON.stringify(nextState))
  } catch {
    // ignore storage failures
  }
}

function restoreBootstrapState(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const workspaceId = params.get('workspaceId')
  const projectId = params.get('projectId')
  const projectName = params.get('projectName')
  const platformOrigin = params.get('platformOrigin')

  const stored = safeParseBootstrapState(window.sessionStorage.getItem(BOOTSTRAP_STATE_KEY))
  bootstrapState = stored ?? { ...defaultBootstrapState }

  if (!bootstrapState.platformOrigin && document.referrer) {
    try {
      bootstrapState.platformOrigin = new URL(document.referrer).origin
    } catch {
      // ignore malformed referrer
    }
  }

  if (platformOrigin) {
    bootstrapState.platformOrigin = platformOrigin
  }

  if (workspaceId || projectId || projectName || platformOrigin) {
    bootstrapState = {
      ...bootstrapState,
      context: {
        workspaceId: workspaceId ?? bootstrapState.context.workspaceId,
        projectId: projectId ?? bootstrapState.context.projectId,
        projectName: projectName ?? bootstrapState.context.projectName,
      },
      platformOrigin: platformOrigin ?? bootstrapState.platformOrigin,
    }
    persistBootstrapState(bootstrapState)
  }
}

function applyShellBootstrapMessage(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return
  const data = payload as {
    source?: string
    type?: string
    auth?: Partial<OfficeBootstrapAuth>
    context?: Partial<OfficeBootstrapContext>
    platformOrigin?: string | null
  }
  if (data.source !== SHELL_MESSAGE_SOURCE || data.type !== 'office-bootstrap') return

  bootstrapState = {
    auth: {
      token: data.auth?.token ?? bootstrapState.auth.token,
      userId: data.auth?.userId ?? bootstrapState.auth.userId,
      email: data.auth?.email ?? bootstrapState.auth.email,
      name: data.auth?.name ?? bootstrapState.auth.name,
    },
    context: {
      workspaceId: data.context?.workspaceId ?? bootstrapState.context.workspaceId,
      projectId: data.context?.projectId ?? bootstrapState.context.projectId,
      projectName: data.context?.projectName ?? bootstrapState.context.projectName,
    },
    platformOrigin: data.platformOrigin ?? bootstrapState.platformOrigin,
  }
  persistBootstrapState(bootstrapState)

  // Acknowledge receipt back to parent shell
  if (typeof window !== 'undefined' && window.parent !== window) {
    try {
      window.parent.postMessage({ source: ADDIN_MESSAGE_SOURCE, type: 'bootstrap-ack', payload: { ok: true } }, '*')
    } catch {
      // ignore postMessage errors
    }
  }
}

function requestShellBootstrap(): void {
  if (typeof window === 'undefined' || window.parent === window) return
  try {
    window.parent.postMessage(
      {
        source: ADDIN_MESSAGE_SOURCE,
        type: 'bootstrap-request',
        payload: { href: window.location.href },
      },
      '*'
    )
  } catch {
    // ignore postMessage errors
  }
}

function applyAuthBridgeMessage(payload: unknown, sourceOrigin?: string): void {
  if (!payload || typeof payload !== 'object') return
  const data = payload as {
    source?: string
    type?: string
    token?: string
  }
  if (data.source !== AUTH_BRIDGE_MESSAGE_SOURCE || data.type !== 'auth-token') return
  if (!data.token) return
  if (sourceOrigin && sourceOrigin !== getPlatformOrigin()) return

  bootstrapState = {
    ...bootstrapState,
    auth: { ...bootstrapState.auth, token: data.token },
  }
  persistBootstrapState(bootstrapState)

  // Dispatch a custom event so React components can react to the token arrival
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('allternit-office-auth-token-received', { detail: { token: data.token } }))
  }
}

if (typeof window !== 'undefined') {
  restoreBootstrapState()

  // Listen for shell bootstrap messages
  window.addEventListener('message', (event) => {
    applyShellBootstrapMessage(event.data)
    applyAuthBridgeMessage(event.data, event.origin)
  })

  // Listen for auth-bridge tokens via BroadcastChannel (same-origin fallback)
  try {
    const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    bc.onmessage = (event) => {
      applyAuthBridgeMessage(event.data)
    }
  } catch {
    // BroadcastChannel not supported
  }

  // Request an explicit bootstrap from the parent shell in case the iframe
  // loaded after the initial shell-side bootstrap send.
  window.setTimeout(requestShellBootstrap, 50)
  window.setTimeout(requestShellBootstrap, 600)
}

export function setOfficeBootstrapState(nextState: Partial<OfficeBootstrapState>): void {
  bootstrapState = {
    auth: {
      ...bootstrapState.auth,
      ...(nextState.auth ?? {}),
    },
    context: {
      ...bootstrapState.context,
      ...(nextState.context ?? {}),
    },
    platformOrigin: nextState.platformOrigin ?? bootstrapState.platformOrigin,
  }
  persistBootstrapState(bootstrapState)
}

export function getOfficeBootstrapState(): OfficeBootstrapState {
  return bootstrapState
}

/** Manually set the auth token (for standalone use when not in iframe) */
export function setAuthToken(token: string | null): void {
  bootstrapState = {
    ...bootstrapState,
    auth: { ...bootstrapState.auth, token },
  }
  persistBootstrapState(bootstrapState)
}

/** Manually set the workspace/project context */
export function setOfficeContext(context: Partial<OfficeBootstrapContext>): void {
  bootstrapState = {
    ...bootstrapState,
    context: { ...bootstrapState.context, ...context },
  }
  persistBootstrapState(bootstrapState)
}

// ── Workspace / Project API ──────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  title: string
}

export function fetchWithTimeout(url: string, init: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 8000, ...rest } = init
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeout)
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(id))
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/workspaces`, {
    headers: buildGatewayHeaders(),
    timeout: 8000,
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces (${response.status})`)
  }
  const data = (await response.json()) as { workspaces?: Workspace[] }
  return data.workspaces ?? []
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/workflows`, {
    headers: buildGatewayHeaders(),
    timeout: 8000,
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch projects (${response.status})`)
  }
  const data = (await response.json()) as { workflows?: Array<{ id: string; name: string }> }
  return (data.workflows ?? []).map((w) => ({ id: w.id, title: w.name }))
}

export function buildGatewayHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (bootstrapState.auth.token) {
    headers.Authorization = `Bearer ${bootstrapState.auth.token}`
    headers['X-Allternit-Desktop-Access-Token'] = bootstrapState.auth.token
  }
  if (bootstrapState.auth.userId) {
    headers['X-Allternit-User-Id'] = bootstrapState.auth.userId
  }
  if (bootstrapState.auth.email) {
    headers['X-Allternit-User-Email'] = bootstrapState.auth.email
  }
  if (bootstrapState.auth.name) {
    headers['X-Allternit-User-Name'] = bootstrapState.auth.name
  }

  return headers
}

async function getGatewaySessionId(): Promise<string> {
  const existing = await officeStorage.get<string>(GATEWAY_SESSION_ID_KEY)
  if (existing) return existing
  const next = globalThis.crypto?.randomUUID?.() ?? `office-${Date.now()}`
  await officeStorage.set(GATEWAY_SESSION_ID_KEY, next)
  return next
}

export interface OfficeDocumentSnapshot {
  host: string
  title?: string | null
  label?: string | null
  summary?: string | null
  document_url?: string | null
  document_id?: string | null
  fingerprint?: string | null
}

export interface OfficePlatformSnapshot {
  taskpane_origin?: string | null
  taskpane_url?: string | null
  manifest_url?: string | null
  platform_origin?: string | null
}

export interface OfficeRuntimeStateSnapshot {
  status?: string | null
  page_label?: string | null
  current_task?: string | null
  history_count?: number | null
  connected?: boolean | null
}

export interface OfficeBindingSnapshot extends OfficeDocumentSnapshot, OfficePlatformSnapshot, OfficeRuntimeStateSnapshot {
  id: string
  document_key: string
  project_id?: string | null
  workspace_id?: string | null
  created_at?: string
  updated_at?: string
  last_seen_at?: string
  active_session_count?: number
}

export interface OfficeRuntimeSessionSnapshot {
  id: string
  binding_id: string
  status?: string | null
  page_label?: string | null
  current_task?: string | null
  history_count?: number | null
  connected?: boolean | null
  created_at?: string
  updated_at?: string
  last_seen_at?: string
}

export interface OfficeBootstrapResponse {
  ok: boolean
  binding: OfficeBindingSnapshot
  session: OfficeRuntimeSessionSnapshot
  gateway?: {
    base_url: string
    supports_runtime_sync: boolean
  }
}

export async function resolveOfficeDocumentSnapshot(context: DocumentContext): Promise<OfficeDocumentSnapshot> {
  const officeDocument = typeof Office !== 'undefined' ? Office.context?.document : undefined
  const title = context.label || undefined
  const summary = context.summary || undefined
  const documentUrl =
    typeof officeDocument?.url === 'string' && officeDocument.url.length > 0 ? officeDocument.url : undefined
  const rawId =
    typeof officeDocument?.url === 'string' && officeDocument.url.length > 0
      ? officeDocument.url
      : `${context.host}:${context.label}:${summary?.slice(0, 160) ?? ''}`

  return {
    host: context.host,
    title,
    label: context.label,
    summary,
    document_url: documentUrl,
    document_id: rawId,
    fingerprint: globalThis.btoa(
      Array.from(new Uint8Array(new TextEncoder().encode(rawId)))
        .map((b) => String.fromCharCode(b))
        .join('')
    ).slice(0, 120),
  }
}

export async function bootstrapOfficeRuntime(input: {
  document: OfficeDocumentSnapshot
  platform?: OfficePlatformSnapshot
  runtimeState?: OfficeRuntimeStateSnapshot
  projectId?: string | null
  workspaceId?: string | null
}): Promise<OfficeBootstrapResponse> {
  const sessionId = await getGatewaySessionId()
  const response = await fetch(`${getGatewayApiBaseUrl()}/office/bootstrap`, {
    method: 'POST',
    headers: buildGatewayHeaders(),
    body: JSON.stringify({
      session_id: sessionId,
      project_id: input.projectId ?? bootstrapState.context.projectId,
      workspace_id: input.workspaceId ?? bootstrapState.context.workspaceId,
      document: input.document,
      platform: input.platform,
      runtime_state: input.runtimeState,
    }),
  })

  if (!response.ok) {
    throw new Error(`Gateway bootstrap failed (${response.status})`)
  }

  return (await response.json()) as OfficeBootstrapResponse
}

export async function syncOfficeRuntimeState(input: {
  bindingId: string
  document?: OfficeDocumentSnapshot
  platform?: OfficePlatformSnapshot
  runtimeState?: OfficeRuntimeStateSnapshot
  projectId?: string | null
  workspaceId?: string | null
}): Promise<OfficeBootstrapResponse> {
  const sessionId = await getGatewaySessionId()
  const response = await fetch(`${getGatewayApiBaseUrl()}/office/runtime/state`, {
    method: 'POST',
    headers: buildGatewayHeaders(),
    body: JSON.stringify({
      binding_id: input.bindingId,
      session_id: sessionId,
      project_id: input.projectId ?? bootstrapState.context.projectId,
      workspace_id: input.workspaceId ?? bootstrapState.context.workspaceId,
      document: input.document,
      platform: input.platform,
      runtime_state: input.runtimeState,
    }),
  })

  if (!response.ok) {
    throw new Error(`Gateway sync failed (${response.status})`)
  }

  return (await response.json()) as OfficeBootstrapResponse
}
