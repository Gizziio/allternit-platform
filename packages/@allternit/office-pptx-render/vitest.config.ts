import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Always resolve to this repo's workspace sources (consistent with tsconfig paths)
  resolve: {
    alias: {
      // Subpath before the bare name: string aliases are prefix replacements
      '@allternit/office-pptx-engine/table-grid': resolve(here, '../office-pptx-engine/src/table-grid.ts'),
      '@allternit/office-pptx-engine/background-promote': resolve(
        here,
        '../office-pptx-engine/src/background-promote.ts',
      ),
      '@allternit/office-pptx-engine': resolve(here, '../office-pptx-engine/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
