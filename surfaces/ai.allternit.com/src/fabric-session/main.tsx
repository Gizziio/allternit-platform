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
)
