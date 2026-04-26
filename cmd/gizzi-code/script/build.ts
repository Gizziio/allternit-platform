#!/usr/bin/env bun
/**
 * Build script entry point
 * Delegates to the production build pipeline
 */

import { $ } from 'bun'

const args = process.argv.slice(2)

async function main() {
  console.log('Starting build pipeline...')

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: bun run build [options]

Options:
  --all          Build for all platforms (darwin-arm64, darwin-x64, linux-arm64, linux-x64, windows-x64)
  --target=NAME  Build for specific target (e.g., darwin-arm64)
  --clean        Clean build artifacts before building
  --debug        Enable debug output
  --help, -h     Show this help
    `)
    return
  }

  const target = args.find((a) => a.startsWith('--target='))?.split('=')[1]
  const clean = args.includes('--clean')
  const all = args.includes('--all')

  if (clean) {
    console.log('Cleaning build artifacts...')
    try {
      await $`rm -rf .build dist/*.js`
    } catch {
      // ignore
    }
  }

  // Run the production build
  const cmd = ['bun', 'run', 'script/build-production.js']
  if (target) cmd.push(`--target=${target}`)
  if (all) cmd.push('--all')

  console.log(`Running: ${cmd.join(' ')}`)
  await Bun.spawn(cmd, {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  }).exited
}

main().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
