import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GizziRuntimeError,
  requestGizziJson,
} from "@/lib/gizzi-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GizziModel = {
  id: string;
  name?: string;
  capabilities?: Record<string, unknown>;
  limit?: {
    context?: number;
  };
};

type GizziProvider = {
  id: string;
  name?: string;
  description?: string;
  source?: string;
  env?: string[];
  options?: Record<string, unknown>;
  models?: Record<string, GizziModel>;
};

type ProviderAuthMethod = {
  type?: string;
};

function toRouteError(error: unknown): Response {
  if (error instanceof GizziRuntimeError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { error: "Runtime backend request failed" },
    { status: 500 },
  );
}

function extractModelCapabilities(model: GizziModel): string[] {
  return Object.entries(model.capabilities ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([capability]) => capability);
}

function normalizeProvider(provider: GizziProvider) {
  const models = Object.values(provider.models ?? {}).map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
    description: provider.description,
    capabilities: extractModelCapabilities(model),
    context_window: model.limit?.context,
  }));

  return {
    id: provider.id,
    name: provider.name ?? provider.id,
    description: provider.description,
    source: provider.source,
    env: provider.env ?? [],
    options: provider.options ?? {},
    models,
  };
}

function buildProfileIds(providerId: string): string[] {
  return [providerId];
}

function normalizeAuthStatus(
  provider: ReturnType<typeof normalizeProvider>,
  connectedIds: Set<string>,
  authMethods: Record<string, ProviderAuthMethod[]>,
) {
  const methods = authMethods[provider.id] ?? [];
  const authRequired = methods.length > 0;
  const authenticated = connectedIds.has(provider.id) || !authRequired;

  return {
    provider_id: provider.id,
    status: authenticated ? "ok" : authRequired ? "missing" : "not_required",
    authenticated,
    auth_required: authRequired,
    auth_profile_id: authRequired ? provider.id : null,
    chat_profile_ids: buildProfileIds(provider.id),
  };
}

async function loadProviders() {
  const payload = await requestGizziJson<{
    all?: GizziProvider[];
    default?: Record<string, string>;
    connected?: string[];
  }>("/v1/provider");

  const providers = (payload.all ?? []).map(normalizeProvider);
  return {
    providers,
    defaults: payload.default ?? {},
    connected: new Set(payload.connected ?? []),
  };
}

async function getPathSegments(
  context: { params: Promise<{ path?: string[] }> },
): Promise<string[]> {
  const params = await context.params;
  return params.path ?? [];
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    const [{ providers, defaults, connected }, authMethods] = await Promise.all([
      loadProviders(),
      requestGizziJson<Record<string, ProviderAuthMethod[]>>("/v1/provider/auth"),
    ]);

    if (path.length === 0) {
      return NextResponse.json({
        all: providers,
        default: defaults,
        connected: [...connected],
      });
    }

    if (path.length === 2 && path[0] === "auth" && path[1] === "status") {
      return NextResponse.json({
        providers: providers.map((provider) =>
          normalizeAuthStatus(provider, connected, authMethods),
        ),
      });
    }

    if (path.length === 3 && path[1] === "auth" && path[2] === "status") {
      const provider = providers.find((item) => item.id === path[0]);
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 },
        );
      }

      return NextResponse.json(
        normalizeAuthStatus(provider, connected, authMethods),
      );
    }

    const provider = providers.find((item) => item.id === path[0]);
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    if (path.length === 2 && path[1] === "models") {
      return NextResponse.json({
        provider: provider.id,
        profile_id: provider.id,
        fetched_at: new Date().toISOString(),
        supported: true,
        models: provider.models,
        default_model_id: defaults[provider.id] ?? provider.models[0]?.id ?? null,
        allow_freeform: true,
      });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return toRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    const body = await request.json().catch(() => ({}));

    if (path.length === 2 && path[1] === "auth") {
      await requestGizziJson(`/v1/auth/${encodeURIComponent(path[0])}`, {
        method: "PUT",
        body,
      });

      const [{ providers, connected }, authMethods] = await Promise.all([
        loadProviders(),
        requestGizziJson<Record<string, ProviderAuthMethod[]>>("/v1/provider/auth"),
      ]);
      const provider = providers.find((item) => item.id === path[0]);

      if (!provider) {
        return NextResponse.json({ success: true });
      }

      return NextResponse.json(
        normalizeAuthStatus(provider, connected, authMethods),
      );
    }

    if (path.length === 3 && path[1] === "models" && path[2] === "validate") {
      const { providers } = await loadProviders();
      const provider = providers.find((item) => item.id === path[0]);
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 },
        );
      }

      const modelId = String(body.model_id || "");
      const matched = provider.models.find((model) => model.id === modelId);

      return NextResponse.json({
        valid: Boolean(matched),
        status: matched ? "valid" : "invalid",
        model: matched,
        suggested: matched ? [] : provider.models.map((model) => model.id),
        message: matched ? "Model is available" : "Model not found for provider",
      });
    }

    if (path.length === 2 && path[1] === "validate") {
      return NextResponse.json(
        {
          error:
            "Provider credential validation is handled by the runtime auth endpoint and is not exposed as a standalone validate route.",
        },
        { status: 501 },
      );
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return toRouteError(error);
  }
}
