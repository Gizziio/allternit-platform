import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { hydrateRuntimeBackendPreferenceFromClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';

export type RuntimeMode = 'local' | 'byoc-vps' | 'cloud' | 'hybrid';

export interface ResolvedRuntimeBackendTarget {
  id: string;
  sshConnectionId: string;
  name: string;
  status: string;
  installState: string;
  backendUrl: string | null;
  gatewayUrl: string | null;
  gatewayWsUrl: string | null;
  installedVersion: string | null;
  supportedClientRange: string | null;
  lastVerifiedAt: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
}

export interface ResolvedRuntimeBackend {
  mode: RuntimeMode;
  fallbackMode: RuntimeMode;
  source: 'default' | 'user-preference';
  backendTarget: ResolvedRuntimeBackendTarget | null;
  gatewayUrl: string | null;
  gatewayWsUrl: string | null;
  gatewayToken: string | null;
}

function normalizeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
}

export function buildBasicAuthorizationHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export function toGatewayAuthorizationHeader(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^(basic|bearer|token)\s+/i.test(trimmed)) {
    return trimmed;
  }

  return `Bearer ${trimmed}`;
}

function toWsUrl(httpUrl: string | null): string | null {
  if (!httpUrl) return null;
  return httpUrl
    .replace(/^http:\/\//i, 'ws://')
    .replace(/^https:\/\//i, 'wss://')
    .replace(/\/+$/, '');
}

export function defaultBackendUrlForHost(host: string): string {
  return `http://${host}:4096`;
}

export function defaultGatewayUrlForHost(host: string): string {
  return defaultBackendUrlForHost(host);
}

export function defaultGatewayWsUrlForHost(host: string): string {
  return `ws://${host}:4096`;
}

type UpsertTargetInput = {
  userId: string;
  sshConnectionId: string;
  name: string;
  host: string;
  connectionStatus: string;
  allternitInstalled: boolean;
  allternitVersion?: string | null;
  backendUrl?: string | null;
  gatewayUrl?: string | null;
  gatewayWsUrl?: string | null;
  gatewayToken?: string | null;
  lastError?: string | null;
  markVerified?: boolean;
  backendReachable?: boolean;
};

export async function upsertRuntimeBackendTargetFromConnection(
  input: UpsertTargetInput,
) {
  const backendUrl = normalizeHttpUrl(
    input.backendUrl ?? (input.allternitInstalled ? defaultBackendUrlForHost(input.host) : null),
  );
  const gatewayUrl = normalizeHttpUrl(
    input.gatewayUrl ?? (input.allternitInstalled ? defaultGatewayUrlForHost(input.host) : backendUrl),
  );
  const gatewayWsUrl =
    normalizeHttpUrl(input.gatewayWsUrl) ??
    toWsUrl(gatewayUrl ?? backendUrl) ??
    (input.allternitInstalled ? defaultGatewayWsUrlForHost(input.host) : null);

  const installState = input.allternitInstalled ? 'installed' : 'not_installed';
  const status = input.connectionStatus === 'connected'
    ? input.allternitInstalled
      ? input.backendReachable ? 'ready' : 'installed'
      : 'connected'
    : input.connectionStatus;

  const encryptedGatewayToken = input.gatewayToken
    ? encrypt(input.gatewayToken)
    : undefined;

  return prisma.remoteBackendTarget.upsert({
    where: {
      sshConnectionId: input.sshConnectionId,
    },
    update: {
      name: input.name,
      status,
      installState,
      backendUrl,
      gatewayUrl,
      gatewayWsUrl,
      installedVersion: input.allternitVersion ?? undefined,
      lastVerifiedAt: input.markVerified ? new Date() : undefined,
      lastError: input.lastError ?? null,
      ...(encryptedGatewayToken !== undefined
        ? { encryptedGatewayToken }
        : {}),
    },
    create: {
      userId: input.userId,
      sshConnectionId: input.sshConnectionId,
      name: input.name,
      status,
      installState,
      backendUrl,
      gatewayUrl,
      gatewayWsUrl,
      installedVersion: input.allternitVersion ?? undefined,
      lastVerifiedAt: input.markVerified ? new Date() : undefined,
      lastError: input.lastError ?? null,
      ...(encryptedGatewayToken !== undefined
        ? { encryptedGatewayToken }
        : {}),
    },
  });
}

export async function ensureBackendPreference(userId: string) {
  return prisma.userBackendPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      mode: 'local',
      fallbackMode: 'local',
    },
  });
}

export async function setActiveRuntimeBackendPreference(input: {
  userId: string;
  mode?: RuntimeMode;
  fallbackMode?: RuntimeMode;
  backendTargetId?: string | null;
  orgId?: string | null;
}) {
  const current = await ensureBackendPreference(input.userId);

  return prisma.userBackendPreference.update({
    where: { userId: input.userId },
    data: {
      mode: input.mode ?? current.mode,
      fallbackMode: input.fallbackMode ?? current.fallbackMode,
      activeRemoteBackendTargetId:
        input.backendTargetId === undefined
          ? current.activeRemoteBackendTargetId
          : input.backendTargetId,
      orgId: input.orgId === undefined ? current.orgId : input.orgId,
    },
    include: {
      activeRemoteBackendTarget: true,
    },
  });
}

function mapResolvedTarget(
  target: {
    id: string;
    sshConnectionId: string;
    name: string;
    status: string;
    installState: string;
    backendUrl: string | null;
    gatewayUrl: string | null;
    gatewayWsUrl: string | null;
    installedVersion: string | null;
    supportedClientRange: string | null;
    lastVerifiedAt: Date | null;
    lastHeartbeatAt: Date | null;
    lastError: string | null;
  } | null,
): ResolvedRuntimeBackendTarget | null {
  if (!target) return null;

  return {
    id: target.id,
    sshConnectionId: target.sshConnectionId,
    name: target.name,
    status: target.status,
    installState: target.installState,
    backendUrl: target.backendUrl,
    gatewayUrl: target.gatewayUrl,
    gatewayWsUrl: target.gatewayWsUrl,
    installedVersion: target.installedVersion,
    supportedClientRange: target.supportedClientRange,
    lastVerifiedAt: target.lastVerifiedAt?.toISOString() ?? null,
    lastHeartbeatAt: target.lastHeartbeatAt?.toISOString() ?? null,
    lastError: target.lastError,
  };
}

export async function resolveRuntimeBackendForUserId(
  userId: string,
): Promise<ResolvedRuntimeBackend> {
  const preference = await prisma.userBackendPreference.findUnique({
    where: { userId },
    include: {
      activeRemoteBackendTarget: true,
    },
  });

  if (!preference || preference.mode === 'local') {
    return {
      mode: preference?.mode as RuntimeMode ?? 'local',
      fallbackMode: preference?.fallbackMode as RuntimeMode ?? 'local',
      source: preference ? 'user-preference' : 'default',
      backendTarget: mapResolvedTarget(preference?.activeRemoteBackendTarget ?? null),
      gatewayUrl: null,
      gatewayWsUrl: null,
      gatewayToken: null,
    };
  }

  const activeTarget = preference.activeRemoteBackendTarget;
  if (!activeTarget || !activeTarget.gatewayUrl) {
    return {
      mode: 'local',
      fallbackMode: preference.fallbackMode as RuntimeMode,
      source: 'user-preference',
      backendTarget: mapResolvedTarget(activeTarget),
      gatewayUrl: null,
      gatewayWsUrl: null,
      gatewayToken: null,
    };
  }

  return {
    mode: preference.mode as RuntimeMode,
    fallbackMode: preference.fallbackMode as RuntimeMode,
    source: 'user-preference',
    backendTarget: mapResolvedTarget(activeTarget),
    gatewayUrl: activeTarget.gatewayUrl,
    gatewayWsUrl: activeTarget.gatewayWsUrl,
    gatewayToken: activeTarget.encryptedGatewayToken
      ? decrypt(activeTarget.encryptedGatewayToken)
      : null,
  };
}

export async function resolveRuntimeBackendForAuthUserId(authUserId: string) {
  await hydrateRuntimeBackendPreferenceFromClerk(authUserId).catch(() => {
    // Ignore control-plane sync failures and fall back to local state.
  });
  const userId = await resolvePlatformUserId(authUserId);
  const resolved = await resolveRuntimeBackendForUserId(userId);

  return {
    userId,
    ...resolved,
  };
}

export async function verifyRuntimeBackendHealth(
  baseUrl: string,
  options: {
    authorizationHeader?: string | null;
  } = {},
): Promise<{
  reachable: boolean;
  healthUrl: string | null;
}> {
  const normalized = normalizeHttpUrl(baseUrl);
  if (!normalized) {
    return { reachable: false, healthUrl: null };
  }

  const candidates = [
    `${normalized}/v1/global/health`,
    `${normalized}/v1/provider`,
    `${normalized}/health`,
  ];

  const headers = new Headers({
    Accept: 'application/json',
  });
  const authorizationHeader = toGatewayAuthorizationHeader(
    options.authorizationHeader,
  );
  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader);
  }

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        return { reachable: true, healthUrl: candidate };
      }
    } catch {
      // Try the next health endpoint candidate.
    }
  }

  return { reachable: false, healthUrl: null };
}
