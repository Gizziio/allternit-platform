import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { resolvePlatformUserId } from "@/lib/server-user";

type RuntimeMode = "local" | "byoc-vps" | "cloud" | "hybrid";

type ClerkRuntimeBackendTargetMetadata = {
  id: string;
  sshConnectionId: string;
  name: string;
  status: string;
  installState: string;
  backendUrl: string | null;
  gatewayUrl: string | null;
  gatewayWsUrl: string | null;
  gatewayToken: string | null;
  installedVersion: string | null;
  supportedClientRange: string | null;
  lastVerifiedAt: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  authType: string | null;
  connectionStatus: string | null;
  os: string | null;
  architecture: string | null;
  lastConnectedAt: string | null;
};

type ClerkRuntimeBackendMetadata = {
  version: 1;
  updatedAt: string;
  orgId: string | null;
  mode: RuntimeMode;
  fallbackMode: RuntimeMode;
  activeBackend: ClerkRuntimeBackendTargetMetadata | null;
  availableBackends: ClerkRuntimeBackendTargetMetadata[];
};

const CLERK_RUNTIME_METADATA_KEY = "a2rRuntimeBackend";
const HYDRATION_TTL_MS = 60_000;
const lastHydratedAtByAuthUserId = new Map<string, number>();

function shouldSyncWithClerk(authUserId: string): boolean {
  return (
    authUserId !== "local-user" &&
    process.env.ALLTERNIT_PLATFORM_DISABLE_CLERK !== "1"
  );
}

async function getClerkUsersClient(): Promise<any | null> {
  const clerkModule = await import("@clerk/nextjs/server").catch(async () =>
    import("@/stubs/clerk/nextjs-server"),
  );
  const clerkClient = (clerkModule as { clerkClient?: unknown }).clerkClient;
  const resolved =
    typeof clerkClient === "function" ? await clerkClient() : clerkClient;

  if (!resolved?.users?.getUser || !resolved?.users?.updateUserMetadata) {
    return null;
  }

  return resolved;
}

function parseRuntimeMode(value: unknown, fallback: RuntimeMode): RuntimeMode {
  if (
    value === "local" ||
    value === "byoc-vps" ||
    value === "cloud" ||
    value === "hybrid"
  ) {
    return value;
  }

  return fallback;
}

function parseMetadata(
  value: unknown,
): ClerkRuntimeBackendMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    version: 1,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date(0).toISOString(),
    orgId: typeof candidate.orgId === "string" ? candidate.orgId : null,
    mode: parseRuntimeMode(candidate.mode, "local"),
    fallbackMode: parseRuntimeMode(candidate.fallbackMode, "local"),
    activeBackend:
      candidate.activeBackend && typeof candidate.activeBackend === "object"
        ? (candidate.activeBackend as ClerkRuntimeBackendMetadata["activeBackend"])
        : null,
    availableBackends: Array.isArray(candidate.availableBackends)
      ? (candidate.availableBackends as ClerkRuntimeBackendTargetMetadata[])
      : candidate.activeBackend && typeof candidate.activeBackend === "object"
        ? [candidate.activeBackend as ClerkRuntimeBackendTargetMetadata]
        : [],
  };
}

function extractHostFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

async function buildRuntimeBackendMetadata(
  authUserId: string,
): Promise<ClerkRuntimeBackendMetadata> {
  const userId = await resolvePlatformUserId(authUserId);
  const [preference, remoteTargets] = await Promise.all([
    prisma.userBackendPreference.findUnique({
      where: { userId },
      select: {
        orgId: true,
        mode: true,
        fallbackMode: true,
        updatedAt: true,
        activeRemoteBackendTargetId: true,
      },
    }),
    prisma.remoteBackendTarget.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        sshConnection: {
          select: {
            id: true,
            host: true,
            port: true,
            username: true,
            authType: true,
            status: true,
            os: true,
            architecture: true,
            lastConnectedAt: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  const availableBackends = remoteTargets.map((target) => ({
    id: target.id,
    sshConnectionId: target.sshConnectionId,
    name: target.name,
    status: target.status,
    installState: target.installState,
    backendUrl: target.backendUrl,
    gatewayUrl: target.gatewayUrl,
    gatewayWsUrl: target.gatewayWsUrl,
    gatewayToken: target.encryptedGatewayToken
      ? decrypt(target.encryptedGatewayToken)
      : null,
    installedVersion: target.installedVersion,
    supportedClientRange: target.supportedClientRange,
    lastVerifiedAt: target.lastVerifiedAt?.toISOString() ?? null,
    lastHeartbeatAt: target.lastHeartbeatAt?.toISOString() ?? null,
    lastError: target.lastError,
    host: target.sshConnection?.host ?? extractHostFromUrl(target.gatewayUrl),
    port: target.sshConnection?.port ?? 22,
    username: target.sshConnection?.username ?? null,
    authType: target.sshConnection?.authType ?? null,
    connectionStatus: target.sshConnection?.status ?? null,
    os: target.sshConnection?.os ?? null,
    architecture: target.sshConnection?.architecture ?? null,
    lastConnectedAt: target.sshConnection?.lastConnectedAt?.toISOString() ?? null,
  }));
  const activeBackend =
    availableBackends.find(
      (target) => target.id === preference?.activeRemoteBackendTargetId,
    ) ?? null;
  const updatedAtMs = Math.max(
    preference?.updatedAt?.getTime() ?? 0,
    ...remoteTargets.map((target) =>
      Math.max(
        target.updatedAt.getTime(),
        target.sshConnection?.updatedAt?.getTime() ?? 0,
      ),
    ),
  );

  return {
    version: 1,
    updatedAt: new Date(updatedAtMs || Date.now()).toISOString(),
    orgId: preference?.orgId ?? null,
    mode: parseRuntimeMode(preference?.mode, "local"),
    fallbackMode: parseRuntimeMode(preference?.fallbackMode, "local"),
    activeBackend,
    availableBackends,
  };
}

export async function syncRuntimeBackendPreferenceToClerk(
  authUserId: string,
): Promise<boolean> {
  if (!shouldSyncWithClerk(authUserId)) {
    return false;
  }

  const usersClient = await getClerkUsersClient();
  if (!usersClient) {
    return false;
  }

  const metadata = await buildRuntimeBackendMetadata(authUserId);
  const user = await usersClient.users.getUser(authUserId);
  await usersClient.users.updateUserMetadata(authUserId, {
    privateMetadata: {
      ...(user?.privateMetadata || {}),
      [CLERK_RUNTIME_METADATA_KEY]: metadata,
    },
  });

  lastHydratedAtByAuthUserId.set(authUserId, Date.now());
  return true;
}

export async function hydrateRuntimeBackendPreferenceFromClerk(
  authUserId: string,
  options: { force?: boolean } = {},
): Promise<boolean> {
  if (!shouldSyncWithClerk(authUserId)) {
    return false;
  }

  const lastHydratedAt = lastHydratedAtByAuthUserId.get(authUserId) ?? 0;
  if (!options.force && Date.now() - lastHydratedAt < HYDRATION_TTL_MS) {
    return false;
  }

  const usersClient = await getClerkUsersClient();
  if (!usersClient) {
    return false;
  }

  const user = await usersClient.users.getUser(authUserId);
  const metadata = parseMetadata(
    user?.privateMetadata?.[CLERK_RUNTIME_METADATA_KEY],
  );
  lastHydratedAtByAuthUserId.set(authUserId, Date.now());

  if (!metadata) {
    return false;
  }

  const userId = await resolvePlatformUserId(authUserId);
  const currentPreference = await prisma.userBackendPreference.findUnique({
    where: { userId },
    select: {
      updatedAt: true,
    },
  });

  const metadataUpdatedAt = Date.parse(metadata.updatedAt);
  if (
    !options.force &&
    currentPreference?.updatedAt &&
    Number.isFinite(metadataUpdatedAt) &&
    currentPreference.updatedAt.getTime() >= metadataUpdatedAt
  ) {
    return false;
  }

  const availableBackends =
    metadata.availableBackends.length > 0
      ? metadata.availableBackends
      : metadata.activeBackend
        ? [metadata.activeBackend]
        : [];

  for (const backend of availableBackends) {
    const sshConnectionId = backend.sshConnectionId;
    const host =
      backend.host ||
      extractHostFromUrl(backend.gatewayUrl) ||
      extractHostFromUrl(backend.backendUrl) ||
      "unknown";
    const port = backend.port ?? 22;
    const username = backend.username || "root";
    const authType = backend.authType || "password";

    await prisma.sshConnection.upsert({
      where: { id: sshConnectionId },
      update: {
        userId,
        name: backend.name,
        host,
        port,
        username,
        authType,
        status:
          backend.connectionStatus ||
          (metadata.mode === "byoc-vps" &&
          metadata.activeBackend?.id === backend.id
            ? "connected"
            : "disconnected"),
        os: backend.os,
        architecture: backend.architecture,
        a2rInstalled:
          backend.installState === "installed" ||
          Boolean(backend.backendUrl || backend.gatewayUrl),
        a2rVersion: backend.installedVersion,
        lastConnectedAt: backend.lastConnectedAt
          ? new Date(backend.lastConnectedAt)
          : metadata.mode === "byoc-vps" &&
              metadata.activeBackend?.id === backend.id
            ? new Date(metadata.updatedAt)
            : undefined,
      },
      create: {
        id: sshConnectionId,
        userId,
        name: backend.name,
        host,
        port,
        username,
        authType,
        status:
          backend.connectionStatus ||
          (metadata.mode === "byoc-vps" &&
          metadata.activeBackend?.id === backend.id
            ? "connected"
            : "disconnected"),
        os: backend.os,
        architecture: backend.architecture,
        a2rInstalled:
          backend.installState === "installed" ||
          Boolean(backend.backendUrl || backend.gatewayUrl),
        a2rVersion: backend.installedVersion,
        lastConnectedAt: backend.lastConnectedAt
          ? new Date(backend.lastConnectedAt)
          : metadata.mode === "byoc-vps" &&
              metadata.activeBackend?.id === backend.id
            ? new Date(metadata.updatedAt)
            : null,
      },
    });

    await prisma.remoteBackendTarget.upsert({
      where: { id: backend.id },
      update: {
        userId,
        sshConnectionId,
        name: backend.name,
        status: backend.status,
        installState: backend.installState,
        backendUrl: backend.backendUrl,
        gatewayUrl: backend.gatewayUrl,
        gatewayWsUrl: backend.gatewayWsUrl,
        encryptedGatewayToken: backend.gatewayToken
          ? encrypt(backend.gatewayToken)
          : null,
        installedVersion: backend.installedVersion,
        supportedClientRange: backend.supportedClientRange,
        lastVerifiedAt: backend.lastVerifiedAt
          ? new Date(backend.lastVerifiedAt)
          : null,
        lastHeartbeatAt: backend.lastHeartbeatAt
          ? new Date(backend.lastHeartbeatAt)
          : null,
        lastError: backend.lastError,
      },
      create: {
        id: backend.id,
        userId,
        sshConnectionId,
        name: backend.name,
        status: backend.status,
        installState: backend.installState,
        backendUrl: backend.backendUrl,
        gatewayUrl: backend.gatewayUrl,
        gatewayWsUrl: backend.gatewayWsUrl,
        encryptedGatewayToken: backend.gatewayToken
          ? encrypt(backend.gatewayToken)
          : null,
        installedVersion: backend.installedVersion,
        supportedClientRange: backend.supportedClientRange,
        lastVerifiedAt: backend.lastVerifiedAt
          ? new Date(backend.lastVerifiedAt)
          : null,
        lastHeartbeatAt: backend.lastHeartbeatAt
          ? new Date(backend.lastHeartbeatAt)
          : null,
        lastError: backend.lastError,
      },
    });
  }

  const syncedTargetIds = availableBackends.map((backend) => backend.id);
  const staleTargets = await prisma.remoteBackendTarget.findMany({
    where: {
      userId,
      ...(syncedTargetIds.length > 0
        ? {
            id: {
              notIn: syncedTargetIds,
            },
          }
        : {}),
    },
    select: {
      id: true,
      sshConnectionId: true,
      sshConnection: {
        select: {
          encryptedPrivateKey: true,
          encryptedPassword: true,
        },
      },
    },
  });
  const stalePlaceholderTargets = staleTargets.filter(
    (target) =>
      !target.sshConnection?.encryptedPrivateKey &&
      !target.sshConnection?.encryptedPassword,
  );

  if (stalePlaceholderTargets.length > 0) {
    await prisma.remoteBackendTarget.deleteMany({
      where: {
        id: {
          in: stalePlaceholderTargets.map((target) => target.id),
        },
      },
    });
    await prisma.sshConnection.deleteMany({
      where: {
        id: {
          in: stalePlaceholderTargets.map((target) => target.sshConnectionId),
        },
      },
    });
  }

  await prisma.userBackendPreference.upsert({
    where: { userId },
    update: {
      orgId: metadata.orgId,
      mode: metadata.mode,
      fallbackMode: metadata.fallbackMode,
      activeRemoteBackendTargetId:
        metadata.mode === "local" ? null : metadata.activeBackend?.id ?? null,
      updatedAt: new Date(metadata.updatedAt),
    },
    create: {
      userId,
      orgId: metadata.orgId,
      mode: metadata.mode,
      fallbackMode: metadata.fallbackMode,
      activeRemoteBackendTargetId:
        metadata.mode === "local" ? null : metadata.activeBackend?.id ?? null,
      createdAt: new Date(metadata.updatedAt),
      updatedAt: new Date(metadata.updatedAt),
    },
  });

  return true;
}
