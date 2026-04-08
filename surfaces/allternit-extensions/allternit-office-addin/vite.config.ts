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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    https: getHttpsConfig(),
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        taskpane: resolve(__dirname, 'src/taskpane/index.html'),
      },
    },
    minify: false,
    sourcemap: true,
  },
})
