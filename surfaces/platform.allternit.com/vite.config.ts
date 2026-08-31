import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3016,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.CI !== 'true',
  },
})
