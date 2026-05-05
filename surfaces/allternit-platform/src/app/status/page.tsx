"use client"

import { useEffect, useRef, useState } from "react"

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

const statusConfig: Record<ServiceStatus, { label: string; color: string; bg: string; dot: string }> = {
  operational: { label: "Operational", color: "#2D6A4F", bg: "#D8F3DC", dot: "#2D6A4F" },
  degraded:    { label: "Degraded",    color: "#7B5E00", bg: "#FFF3CD", dot: "#B87D00" },
  outage:      { label: "Outage",      color: "#9B1C1C", bg: "#FEE2E2", dot: "#DC2626" },
}

const overallMessages: Record<ServiceStatus, string> = {
  operational: "All systems operational",
  degraded:    "Some services degraded",
  outage:      "Service disruption detected",
}

const POLL_INTERVAL = 30_000 // 30s

function formatLatency(ms: number | null): string {
  if (ms === null) return "timeout"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCheckedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" })
      if (!res.ok) throw new Error("Non-OK response")
      const json: StatusResponse = await res.json()
      setData(json)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setCountdown(POLL_INTERVAL / 1000)
    }
  }

  useEffect(() => {
    fetchStatus()

    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL)

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const overall = data?.overall ?? "operational"
  const cfg = statusConfig[overall]

  return (
    <div style={{ background: "#FDF8F3", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #E8D9C8",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "#D97757" }}>A://</span>
          <span style={{ fontFamily: "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif", fontSize: 18, color: "#1A1612" }}>LLTERNIT</span>
        </a>
        <a href="https://allternit.com" style={{ fontSize: 13, color: "#9B9B9B", textDecoration: "none" }}>← allternit.com</a>
      </nav>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <header style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "#D97757", marginBottom: 12 }}>
            Operations
          </p>
          <h1 style={{
            fontFamily: "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif",
            fontWeight: 400,
            fontSize: 40,
            color: "#1A1612",
            lineHeight: 1.1,
            marginBottom: 16,
          }}>
            System Status
          </h1>

          {/* Overall banner */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            background: loading ? "#F0EDE9" : cfg.bg,
            color: loading ? "#9B9B9B" : cfg.color,
            fontSize: 14,
            fontWeight: 500,
            transition: "background 0.3s, color 0.3s",
          }}>
            {loading ? (
              <>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#C8C2BB", display: "inline-block",
                }} />
                Checking services…
              </>
            ) : error ? (
              <>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#DC2626", display: "inline-block",
                }} />
                Status unavailable
              </>
            ) : (
              <>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: cfg.dot,
                  display: "inline-block",
                  boxShadow: overall === "operational"
                    ? "0 0 0 3px rgba(45,106,79,0.2)"
                    : overall === "degraded"
                    ? "0 0 0 3px rgba(184,125,0,0.2)"
                    : "0 0 0 3px rgba(220,38,38,0.2)",
                }} />
                {overallMessages[overall]}
              </>
            )}
          </div>
        </header>

        {/* Service list */}
        <div style={{ border: "1px solid #E8D9C8", borderRadius: 12, overflow: "hidden" }}>
          {loading && !data ? (
            // Skeleton
            Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderTop: i > 0 ? "1px solid #E8D9C8" : "none",
                  background: "#FFFFFF",
                }}
              >
                <div style={{ height: 14, width: 140, borderRadius: 4, background: "#EDE9E3" }} />
                <div style={{ height: 22, width: 88, borderRadius: 20, background: "#EDE9E3" }} />
              </div>
            ))
          ) : (
            (data?.services ?? []).map((svc, i) => {
              const s = statusConfig[svc.status]
              return (
                <div
                  key={svc.slug}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderTop: i > 0 ? "1px solid #E8D9C8" : "none",
                    background: "#FFFFFF",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: s.dot,
                      flexShrink: 0,
                      display: "inline-block",
                    }} />
                    <span style={{ fontSize: 14, color: "#1A1612", fontWeight: 500 }}>{svc.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {svc.latencyMs !== null && svc.status !== "outage" && (
                      <span style={{ fontSize: 12, color: "#9B9B9B", fontFamily: "var(--font-mono)" }}>
                        {formatLatency(svc.latencyMs)}
                      </span>
                    )}
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: s.color,
                      background: s.bg,
                      padding: "3px 10px",
                      borderRadius: 20,
                    }}>
                      {s.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer meta */}
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: "#9B9B9B" }}>
            {data?.checkedAt
              ? <>Last checked at {formatCheckedAt(data.checkedAt)} · refreshing in {countdown}s</>
              : "Checking…"
            }
          </p>
          <button
            onClick={() => { setLoading(true); fetchStatus() }}
            style={{
              fontSize: 12,
              color: "#C45C26",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Refresh now
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 13, color: "#9B9B9B", textAlign: "center" }}>
          For incidents, see{" "}
          <a href="https://allternit.com/news" style={{ color: "#C45C26" }}>News</a>.
        </p>
      </main>

      <footer style={{ borderTop: "1px solid #E8D9C8", padding: "24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9B9B9B" }}>© 2026 Allternit PBC</p>
      </footer>
    </div>
  )
}
