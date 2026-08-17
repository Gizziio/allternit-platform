import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import type { Plugin } from 'vite'

/**
 * The vendored office apps import small PNG icons from a relative `../assets`
 * directory that was not committed. This plugin resolves those imports to
 * inline base64 data URLs so the standalone surface can build without forking
 * the vendored renderer.
 */
function officeAssetStubPlugin(): Plugin {
  const aiPanelPattern = /\/office-(pdf|slides|sheets)-app\/src\/renderer\/ai\/[^/]+\.tsx$/
  const pngImportPattern = /^\.\.\/assets\/(.+\.png)$/i

  return {
    name: 'office-asset-stub',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !aiPanelPattern.test(importer)) return null
      const match = pngImportPattern.exec(source)
      if (!match) return null
      const filePath = path.resolve(path.dirname(importer), source)
      return `\0office-asset:${filePath}`
    },
    load(id) {
      if (!id.startsWith('\0office-asset:')) return null
      const filePath = id.slice('\0office-asset:'.length)
      try {
        const base64 = fs.readFileSync(filePath, 'base64')
        return `export default "data:image/png;base64,${base64}";`
      } catch {
        return `export default "";`
      }
    },
  }
}

export default defineConfig({
  plugins: [officeAssetStubPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3015,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
