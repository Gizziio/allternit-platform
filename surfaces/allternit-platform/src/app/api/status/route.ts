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
  url: string
  timeout?: number
  degradedThreshold?: number
  auth?: "gizzi"
}

const SERVICES: ServiceDef[] = [
  {
    name: "Allternit API",
    slug: "allternit-api",
    url: `${process.env.KERNEL_URL ?? "http://127.0.0.1:3004"}/health`,
  },
  {
    name: "Gateway",
    slug: "gateway",
    url: `${process.env.HTTP_GATEWAY_URL ?? "http://127.0.0.1:8013"}/health`,
  },
  {
    name: "Gateway Auth",
    slug: "gateway-auth",
    url: `${process.env.HTTP_GATEWAY_URL ?? "http://127.0.0.1:8013"}/api/v1/providers/auth/status`,
  },
  {
    name: "Gizzi Runtime",
    slug: "gizzi-runtime",
    url: `${process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096"}/v1/global/health`,
    auth: "gizzi",
  },
]

function getGizziAuthHeader(): string | undefined {
  const username = process.env.GIZZI_USERNAME ?? process.env.NEXT_PUBLIC_GIZZI_USERNAME ?? "gizzi"
  const password = process.env.GIZZI_PASSWORD ?? process.env.NEXT_PUBLIC_GIZZI_PASSWORD
  if (!password) return undefined
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

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
      headers: {
        Accept: "application/json",
        ...(svc.auth === "gizzi" && getGizziAuthHeader()
          ? { Authorization: getGizziAuthHeader()! }
          : {}),
      },
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
