"use client"

import { SignIn, useAuth } from "@clerk/nextjs"
import { useEffect, useRef, useState } from "react"

export default function TerminalClerkPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [status, setStatus] = useState<"idle" | "connecting" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const posted = useRef(false)

  // Persist callback_url in sessionStorage so it survives Clerk's post-sign-in redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cb = params.get("callback_url")
    if (cb) sessionStorage.setItem("allternit_callback_url", cb)
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || posted.current) return
    const callbackUrl = sessionStorage.getItem("allternit_callback_url")
    if (!callbackUrl) return
    posted.current = true
    setStatus("connecting")

    getToken()
      .then((token) => {
        if (!token) throw new Error("No token from Clerk")
        return fetch(callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
      })
      .then((res) => {
        if (!res.ok) throw new Error(`Callback error (${res.status})`)
        sessionStorage.removeItem("allternit_callback_url")
        setStatus("done")
        setTimeout(() => window.close(), 2000)
      })
      .catch((err) => {
        setErrorMsg(err.message)
        setStatus("error")
      })
  }, [isLoaded, isSignedIn])

  if (status === "done") {
    return (
      <Center>
        <Card color="#16a34a">
          <h1 style={{ color: "#16a34a", margin: "0 0 8px", fontSize: 22, fontWeight: 600 }}>Connected!</h1>
          <p style={sub}>Return to your terminal. This window will close.</p>
        </Card>
      </Center>
    )
  }

  if (status === "error") {
    return (
      <Center>
        <Card color="#dc2626">
          <h1 style={{ color: "#dc2626", margin: "0 0 8px", fontSize: 22, fontWeight: 600 }}>Connection failed</h1>
          <p style={sub}>{errorMsg}</p>
        </Card>
      </Center>
    )
  }

  if (status === "connecting") {
    return (
      <Center>
        <Card>
          <p style={sub}>Connecting gizzi-code to your account…</p>
        </Card>
      </Center>
    )
  }

  if (isLoaded && isSignedIn) {
    return (
      <Center>
        <Card>
          <p style={sub}>Finalizing…</p>
        </Card>
      </Center>
    )
  }

  return (
    <Center>
      <p style={{ ...sub, marginBottom: 20 }}>Sign in to connect gizzi-code to your Allternit account.</p>
      <SignIn afterSignInUrl="/terminal/clerk" afterSignUpUrl="/terminal/clerk" />
    </Center>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#f9fafb", fontFamily: "var(--font-ui)" }}>
      {children}
    </div>
  )
}

function Card({ children, color = "#e5e7eb" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ padding: "32px 40px", borderRadius: 12, border: `1px solid ${color}`, background: "#fff", textAlign: "center", maxWidth: 400, width: "100%" }}>
      {children}
    </div>
  )
}

const sub: React.CSSProperties = { margin: 0, fontSize: 14, color: "#6b7280" }
