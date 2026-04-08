import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ServiceStatus = "operational" | "degraded" | "outage"

interface ServiceResult {
  name: string
  slug: string
  status: ServiceStatus
  latencyMs: number | null
  checkedAt: string
}

interface StatusResponse {
  services: ServiceResult[]
  overall: ServiceStatus
  checkedAt: string
}

interface ServiceDef {
  name: string
  slug: string
  /** health endpoint URL — reads env var with local fallback */
  url: string
  /** ms before marking as outage (default 3000) */
  timeout?: number
  /** ms above which status is degraded rather than operational (default 800) */
  degradedThreshold?: number
}

const SERVICES: ServiceDef[] = [
  {
    name: "Rails API",
    slug: "rails-api",
    url: `${process.env.RAILS_API_URL ?? "http://localhost:3002"}/health`,
  },
  {
    name: "API Gateway",
    slug: "http-gateway",
    url: `${process.env.HTTP_GATEWAY_URL ?? "http://localhost:3210"}/health`,
  },
  {
    name: "A2A Gateway",
    slug: "a2a-gateway",
    url: `${process.env.A2A_GATEWAY_URL ?? "http://localhost:8012"}/health`,
  },
  {
    name: "WebSocket / AGUI",
    slug: "agui-gateway",
    url: `${process.env.AGUI_GATEWAY_URL ?? "http://localhost:8010"}/health`,
  },
  {
    name: "Memory Agent",
    slug: "memory",
    url: `${process.env.MEMORY_API_URL ?? "http://localhost:3201"}/health`,
  },
  {
    name: "Chat Rooms",
    slug: "chat-rooms",
    url: `${process.env.CHAT_ROOMS_URL ?? "http://localhost:8080"}/health`,
  },
  {
    name: "Gizzi Runtime",
    slug: "gizzi-runtime",
    url: `${process.env.KERNEL_URL ?? "http://127.0.0.1:3004"}/health`,
  },
]

async function checkService(svc: ServiceDef): Promise<ServiceResult> {
  const timeout = svc.timeout ?? 3000
  const degradedThreshold = svc.degradedThreshold ?? 800
  const checkedAt = new Date().toISOString()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const start = Date.now()
  try {
    const res = await fetch(svc.url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Don't follow redirects — a redirect on /health is suspicious
      redirect: "error",
    })
    const latencyMs = Date.now() - start

    let status: ServiceStatus
    if (!res.ok) {
      status = "outage"
    } else if (latencyMs > degradedThreshold) {
      status = "degraded"
    } else {
      status = "operational"
    }

    return { name: svc.name, slug: svc.slug, status, latencyMs, checkedAt }
  } catch {
    const latencyMs = Date.now() - start
    return {
      name: svc.name,
      slug: svc.slug,
      status: "outage",
      latencyMs: controller.signal.aborted ? null : latencyMs,
      checkedAt,
    }
  } finally {
    clearTimeout(timer)
  }
}

function overallStatus(services: ServiceResult[]): ServiceStatus {
  if (services.some((s) => s.status === "outage")) return "outage"
  if (services.some((s) => s.status === "degraded")) return "degraded"
  return "operational"
}

export async function GET(): Promise<Response> {
  const results = await Promise.all(SERVICES.map(checkService))

  const body: StatusResponse = {
    services: results,
    overall: overallStatus(results),
    checkedAt: new Date().toISOString(),
  }

  return NextResponse.json(body, {
    headers: {
      // Allow status page to read this without auth; short cache
      "Cache-Control": "no-store",
    },
  })
}
