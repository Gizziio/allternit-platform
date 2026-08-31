"use client"

import { useEffect, useState } from "react"
import { AProtocolWordmark } from "../components/AProtocolWordmark"

interface LeaderboardMetric {
  key: string
  label: string
  format: "percent" | "number" | "duration"
}

interface LeaderboardEntry {
  rank: number
  agent: string
  organization: string
  successRate: number
  avgSteps: number
  avgLatencyMs: number
  safetyScore: number
  verified: boolean
}

interface LeaderboardData {
  updatedAt: string
  benchmark: string
  description: string
  metrics: LeaderboardMetric[]
  entries: LeaderboardEntry[]
}

function formatValue(value: number, format: LeaderboardMetric["format"]): string {
  if (format === "percent") return `${(value * 100).toFixed(0)}%`
  if (format === "duration") return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`
  return value.toFixed(1)
}

export default function BenchmarkLeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/benchmarks/computer-use-leaderboard.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Non-OK response")
        return res.json() as Promise<LeaderboardData>
      })
      .then((json) => {
        setData(json)
        setError(false)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: "#FDF8F3", minHeight: "100vh" }}>
      <nav
        style={{
          borderBottom: "1px solid #E8D9C8",
          padding: "0 32px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }} aria-label="Allternit">
          <AProtocolWordmark theme="ink" height={16} />
        </a>
        <a href="https://allternit.com" style={{ fontSize: 13, color: "#9B9B9B", textDecoration: "none" }}>
          ← allternit.com
        </a>
      </nav>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "64px 32px" }}>
        <header style={{ marginBottom: 48 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#D97757",
              marginBottom: 12,
            }}
          >
            Benchmarks
          </p>
          <h1
            style={{
              fontFamily: "var(--font-research)",
              fontWeight: 400,
              fontSize: 40,
              color: "#1A1612",
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            {data?.benchmark ?? "Computer-Use Leaderboard"}
          </h1>
          <p style={{ fontSize: 16, color: "#6B6B6B", maxWidth: 640, lineHeight: 1.5 }}>
            {data?.description ?? "Public evaluation of agent runtimes on real-world browser tasks."}
          </p>
        </header>

        <div style={{ border: "1px solid #E8D9C8", borderRadius: 12, overflow: "hidden", background: "#FFFFFF" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F5F1EC" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Rank</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Agent</th>
                {data?.metrics.map((metric) => (
                  <th
                    key={metric.key}
                    style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}
                  >
                    {metric.label}
                  </th>
                )) ?? (
                  <>
                    <th style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Success</th>
                    <th style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Steps</th>
                    <th style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Latency</th>
                    <th style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, color: "#6B6B6B", fontWeight: 600 }}>Safety</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #E8D9C8" }}>
                    <td style={{ padding: "16px 20px" }}><div style={{ height: 14, width: 24, borderRadius: 4, background: "#EDE9E3" }} /></td>
                    <td style={{ padding: "16px 20px" }}><div style={{ height: 14, width: 180, borderRadius: 4, background: "#EDE9E3" }} /></td>
                    <td style={{ padding: "16px 20px" }}><div style={{ height: 14, width: 48, borderRadius: 4, background: "#EDE9E3", marginLeft: "auto" }} /></td>
                    <td style={{ padding: "16px 20px" }}><div style={{ height: 14, width: 48, borderRadius: 4, background: "#EDE9E3", marginLeft: "auto" }} /></td>
                    <td style={{ padding: "16px 20px" }}><div style={{ height: 14, width: 48, borderRadius: 4, background: "#EDE9E3", marginLeft: "auto" }} /></td>
                    <td style={{ padding: "16px 20px" }}><div style={{ height: 14, width: 48, borderRadius: 4, background: "#EDE9E3", marginLeft: "auto" }} /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#9B1C1C" }}>
                    Failed to load leaderboard.
                  </td>
                </tr>
              ) : (
                data?.entries.map((entry, index) => (
                  <tr key={index} style={{ borderTop: "1px solid #E8D9C8" }}>
                    <td style={{ padding: "16px 20px", fontSize: 14, color: "#1A1612", fontWeight: 600 }}>#{entry.rank}</td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, color: "#1A1612", fontWeight: 500 }}>{entry.agent}</span>
                        {entry.verified && (
                          <span
                            style={{
                              fontSize: 10,
                              color: "#2D6A4F",
                              background: "#D8F3DC",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            Verified
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#9B9B9B" }}>{entry.organization}</div>
                    </td>
                    {data?.metrics ? (
                      data.metrics.map((metric) => (
                        <td
                          key={metric.key}
                          style={{
                            padding: "16px 20px",
                            textAlign: "right",
                            fontSize: 14,
                            color: "#1A1612",
                            fontFamily: metric.format === "number" || metric.format === "duration" ? "var(--font-mono)" : undefined,
                          }}
                        >
                          {formatValue(entry[metric.key as keyof LeaderboardEntry] as number, metric.format)}
                        </td>
                      ))
                    ) : (
                      <>
                        <td style={{ padding: "16px 20px", textAlign: "right", fontSize: 14, color: "#1A1612" }}>
                          {formatValue(entry.successRate, "percent")}
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right", fontSize: 14, color: "#1A1612", fontFamily: "var(--font-mono)" }}>
                          {formatValue(entry.avgSteps, "number")}
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right", fontSize: 14, color: "#1A1612", fontFamily: "var(--font-mono)" }}>
                          {formatValue(entry.avgLatencyMs, "duration")}
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right", fontSize: 14, color: "#1A1612" }}>
                          {formatValue(entry.safetyScore, "percent")}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: "#9B9B9B" }}>
          Last updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "—"}
        </p>
      </main>

      <footer style={{ borderTop: "1px solid #E8D9C8", padding: "24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9B9B9B" }}>© 2026 Allternit PBC</p>
      </footer>
    </div>
  )
}
