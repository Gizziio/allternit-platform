import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/design/ThemeProvider'
import { PlatformAuthProvider } from '@/lib/platform-auth-client'
import { FetchInterceptorProvider } from '@/lib/FetchInterceptorProvider'
import AppRoutes from './routes'

// Global styles
import '@/design/theme.css'
import '@/styles/fonts.css'
import '@/styles/typography.css'
import '@/styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ThemeProvider>
      <PlatformAuthProvider>
        <FetchInterceptorProvider>
          <AppRoutes />
        </FetchInterceptorProvider>
      </PlatformAuthProvider>
    </ThemeProvider>
  </BrowserRouter>
)
