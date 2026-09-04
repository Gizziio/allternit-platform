import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/design/ThemeProvider'
import { PlatformAuthProvider } from '@/lib/platform-auth-client'
import { FetchInterceptorProvider } from '@/lib/FetchInterceptorProvider'
import { CompanyConfigProvider } from '@/providers/company-config-provider'
import AppRoutes from './routes'
import { validatePlatformEnv } from '@/lib/env'
import { ErrorBoundary } from '@/components/error-boundary'
import { initClientErrorReporting, reportReactError } from '@/lib/client-error-report'

// Validate env early so missing required values surface in the console before
// the first network call. In a future build this can block render with a setup card.
const envCheck = validatePlatformEnv();
if (!envCheck.ok) {
  console.error('[Allternit] Missing required environment variables:', envCheck.missing);
}
if (envCheck.warnings.length > 0) {
  console.warn('[Allternit] Environment warnings:', envCheck.warnings);
}

// Global styles
import '@/design/theme.css'
import '@/styles/fonts.css'
import '@/styles/typography.css'
import '@/styles/globals.css'
import '@/styles/allternit-design/tokens.css'
import '@/styles/allternit-design/design-mode-overrides.css'
// Allternit token bridge for the integrated design components
// (src/allternit-design/components). The components' CSS modules read the
// --ad-*-backed vars mapped here; we intentionally do NOT load the
// package's global styles.css to avoid leaking its `button {}` reset
// into native Allternit buttons.
import '@/styles/allternit-design/component-tokens.css'

// Shared React Query client for all views (library, cowork tasks, …).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

// Global window.onerror / unhandledrejection → console + POST /api/v1/client-errors
// (fire-and-forget; self-disabling if the endpoint is down).
initClientErrorReporting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CompanyConfigProvider>
          <PlatformAuthProvider>
            <FetchInterceptorProvider>
              <ErrorBoundary componentName="AppRoot" onError={(error) => reportReactError(error)}>
                <AppRoutes />
              </ErrorBoundary>
            </FetchInterceptorProvider>
          </PlatformAuthProvider>
        </CompanyConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>
)
