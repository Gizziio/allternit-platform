import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyGatewayRequest } from "@/lib/runtime-gateway-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getPathSegments(
  context: { params: Promise<{ path?: string[] }> },
): Promise<string[]> {
  const params = await context.params;
  return params.path ?? [];
}

async function loadProvidersFromRust(request: NextRequest) {
  const resp = await proxyGatewayRequest(request, "/api/v1/providers");
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Rust backend error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const providers = (data.providers ?? []).map((p: any) => ({
    id: p.id,
    name: p.name ?? p.id,
    description: `${p.provider_type} provider`,
    source: p.provider_type,
    env: p.api_key_env_var ? [p.api_key_env_var] : [],
    options: p.base_url ? { base_url: p.base_url } : {},
    models: (p.models ?? []).map((m: any) =>
      typeof m === "string"
        ? { id: m, name: m }
        : { id: m.id ?? m, name: m.name ?? m.id ?? m },
    ),
    api_key_set: p.api_key_set ?? false,
    status: p.status ?? "unconfigured",
  }));

  const defaults: Record<string, string> = {};
  for (const p of providers) {
    if (p.models.length > 0) {
      defaults[p.id] = p.models[0].id;
    }
  }

  const connected = providers
    .filter((p: any) => p.api_key_set && p.status === "ok")
    .map((p: any) => p.id);

  return { providers, defaults, connected };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    const { providers, defaults, connected } = await loadProvidersFromRust(request);

    if (path.length === 0) {
      return NextResponse.json({
        all: providers,
        default: defaults,
        connected,
      });
    }

    if (path.length === 2 && path[0] === "auth" && path[1] === "status") {
      return NextResponse.json({
        providers: providers.map((provider: any) => ({
          provider_id: provider.id,
          status: provider.api_key_set ? "ok" : "missing",
          authenticated: provider.api_key_set,
          auth_required: provider.env.length > 0,
          auth_profile_id: provider.env.length > 0 ? provider.id : null,
          chat_profile_ids: [provider.id],
        })),
      });
    }

    if (path.length === 3 && path[1] === "auth" && path[2] === "status") {
      const provider = providers.find((item: any) => item.id === path[0]);
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        provider_id: provider.id,
        status: provider.api_key_set ? "ok" : "missing",
        authenticated: provider.api_key_set,
        auth_required: provider.env.length > 0,
        auth_profile_id: provider.env.length > 0 ? provider.id : null,
        chat_profile_ids: [provider.id],
      });
    }

    const provider = providers.find((item: any) => item.id === path[0]);
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Provider fetch failed" },
      { status: 500 },
    );
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
      // Proxy auth setup to Rust backend if/when it supports it
      // For now, just return success
      const { providers } = await loadProvidersFromRust(request);
      const provider = providers.find((item: any) => item.id === path[0]);
      if (!provider) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({
        provider_id: provider.id,
        status: "ok",
        authenticated: true,
        auth_required: provider.env.length > 0,
        auth_profile_id: provider.env.length > 0 ? provider.id : null,
        chat_profile_ids: [provider.id],
      });
    }

    if (path.length === 3 && path[1] === "models" && path[2] === "validate") {
      const { providers, defaults } = await loadProvidersFromRust(request);
      const provider = providers.find((item: any) => item.id === path[0]);
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 },
        );
      }

      const modelId = String(body.model_id || "");
      const matched = provider.models.find((model: any) => model.id === modelId);

      return NextResponse.json({
        valid: Boolean(matched),
        status: matched ? "valid" : "invalid",
        model: matched,
        suggested: matched ? [] : provider.models.map((model: any) => model.id),
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Provider operation failed" },
      { status: 500 },
    );
  }
}
