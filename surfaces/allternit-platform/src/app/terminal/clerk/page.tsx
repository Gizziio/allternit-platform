"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { PlatformSignIn, usePlatformAuth } from "@/lib/platform-auth-client"

export default function TerminalClerkPage() {
  const { isLoaded, isSignedIn, getToken } = usePlatformAuth()
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
        <Card variant="success">
          <h1 className="text-green-600 m-0 mb-2 text-[22px] font-semibold">Connected!</h1>
          <p className={sub}>Return to your terminal. This window will close.</p>
        </Card>
      </Center>
    )
  }

  if (status === "error") {
    return (
      <Center>
        <Card variant="error">
          <h1 className="text-red-600 m-0 mb-2 text-[22px] font-semibold">Connection failed</h1>
          <p className={sub}>{errorMsg}</p>
        </Card>
      </Center>
    )
  }

  if (status === "connecting") {
    return (
      <Center>
        <Card>
          <p className={sub}>Connecting Gizzi to your account…</p>
        </Card>
      </Center>
    )
  }

  if (isLoaded && isSignedIn) {
    return (
      <Center>
        <Card>
          <p className={sub}>Finalizing…</p>
        </Card>
      </Center>
    )
  }

  return (
    <Center>
      <p className={cn(sub, "mb-5")}>Sign in to connect Gizzi to your Allternit account.</p>
      <PlatformSignIn forceRedirectUrl="/terminal/clerk" signUpForceRedirectUrl="/terminal/clerk" />
    </Center>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-gray-50">
      {children}
    </div>
  )
}

function Card({ children, variant }: { children: React.ReactNode; variant?: "success" | "error" }) {
  return (
    <div className={cn(
      "p-8 rounded-xl border bg-white text-center max-w-sm w-full",
      variant === "success" && "border-green-600",
      variant === "error" && "border-red-600",
      !variant && "border-gray-200"
    )}>
      {children}
    </div>
  )
}

const sub = "m-0 text-sm text-gray-500"
