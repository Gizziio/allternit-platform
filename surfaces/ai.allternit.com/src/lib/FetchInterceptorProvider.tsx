"use client"

import React, { useEffect } from 'react';
import { installFetchInterceptor } from "./fetch-interceptor"

export function FetchInterceptorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installFetchInterceptor()
  }, [])

  return <>{children}</>
}
