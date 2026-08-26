import baseConfig from './vite.config.js'
import path from 'node:path'
import { defineConfig, mergeConfig } from 'vite'

/**
 * Dedicated production build for the Remote Control dashboard/PWA.
 *
 * The remote-control entry does not use the office-suite workspace packages,
 * but the shared providers still pull them into the module graph. Those
 * packages ship unbuilt source and fail Rollup resolution in CI, so we
 * externalize the whole office suite for this entry. The runtime never
 * executes those code paths.
 */
export default defineConfig((env) =>
  mergeConfig(
    typeof baseConfig === 'function' ? baseConfig(env) : baseConfig,
    {
      build: {
        outDir: 'dist-remote-control',
        rollupOptions: {
          input: {
            'remote-control': path.resolve(__dirname, 'remote-control.html'),
          },
          external: [
            /.*domains\/agent\/allternit-agent-workspace\/pkg.*/,
            'better-sqlite3',
            /^better-sqlite3(\/.+)?$/,
            /^@allternit\/office-.*$/,
          ],
        },
      },
    }
  )
)
