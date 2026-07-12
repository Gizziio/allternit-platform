import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/design/ThemeProvider'
import { PlatformAuthProvider } from '@/lib/platform-auth-client'
import { FetchInterceptorProvider } from '@/lib/FetchInterceptorProvider'
import { CompanyConfigProvider } from '@/providers/company-config-provider'
import AppRoutes from './routes'
import { validatePlatformEnv } from '@/lib/env'

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ThemeProvider>
      <CompanyConfigProvider>
        <PlatformAuthProvider>
          <FetchInterceptorProvider>
            <AppRoutes />
          </FetchInterceptorProvider>
        </PlatformAuthProvider>
      </CompanyConfigProvider>
    </ThemeProvider>
  </BrowserRouter>
)
