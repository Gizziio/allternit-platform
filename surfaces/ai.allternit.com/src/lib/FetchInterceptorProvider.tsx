"use client"

import { useEffect } from "react"
import { installFetchInterceptor } from "./fetch-interceptor"

export function FetchInterceptorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installFetchInterceptor()
  }, [])

  return <>{children}</>
}
