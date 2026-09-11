import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FabricSessionThemeProvider } from './theme/FabricSessionThemeProvider'
import { PlatformAuthProvider } from '@/lib/platform-auth-client'
import { FetchInterceptorProvider } from '@/lib/FetchInterceptorProvider'
import { CompanyConfigProvider } from '@/providers/company-config-provider'
import { ToastProvider } from '@/components/ui/toast-provider'
import { FabricSessionApp } from './App'

class FabricErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { err: error instanceof Error ? error.message : String(error) }
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, fontFamily: '-apple-system, system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 18 }}>Fabric Session failed to load</h1>
          <p style={{ color: '#666' }}>{this.state.err}</p>
          <p>
            On Safari: Settings → Safari → Advanced → Experimental Features, or hard-refresh.
            If you see “No machines paired”, run <code>ao fabric pair --re-pair</code> on this Mac
            while signed into the same Allternit account.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

import '@/design/theme.css'
import '@/styles/fonts.css'
import '@/styles/typography.css'
import '@/styles/globals.css'
import '@/styles/allternit-design/tokens.css'
import '@/styles/allternit-design/design-mode-overrides.css'
import '@/styles/allternit-design/component-tokens.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <FabricErrorBoundary>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <FabricSessionThemeProvider>
          <CompanyConfigProvider>
            <PlatformAuthProvider>
              <FetchInterceptorProvider>
                <ToastProvider>
                  <FabricSessionApp />
                </ToastProvider>
              </FetchInterceptorProvider>
            </PlatformAuthProvider>
          </CompanyConfigProvider>
        </FabricSessionThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </FabricErrorBoundary>
)
