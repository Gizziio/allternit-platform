import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { defineConfig } from 'vite'

// Use certs installed by `office-addin-dev-certs install` (npm run certs)
// Falls back to plain HTTP if certs not yet installed (first-time setup)
function getHttpsConfig() {
  const certDir = join(homedir(), '.office-addin-dev-certs')
  try {
    return {
      key: readFileSync(join(certDir, 'localhost.key')),
      cert: readFileSync(join(certDir, 'localhost.crt')),
      ca: readFileSync(join(certDir, 'ca.crt')),
    }
  } catch {
    return undefined
  }
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  // Validate required production env vars in CI so bad builds fail fast
  if (isProduction && process.env.CI) {
    const missing: string[] = []
    if (!process.env.VITE_ALLTERNIT_GATEWAY_URL) missing.push('VITE_ALLTERNIT_GATEWAY_URL')
    if (!process.env.VITE_ALLTERNIT_PLATFORM_URL) missing.push('VITE_ALLTERNIT_PLATFORM_URL')
    if (missing.length > 0) {
      throw new Error(
        `Production build missing required environment variables: ${missing.join(', ')}\n` +
        `These must be set at build time so the add-in knows where to connect.`
      )
    }
  }

  return {
    base: process.env.VITE_ALLTERNIT_OFFICE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      https: getHttpsConfig(),
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          taskpane: resolve(__dirname, 'src/taskpane/index.html'),
        },
      },
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction,
    },
  }
})
