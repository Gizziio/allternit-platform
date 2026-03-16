/**
 * Test Mode Switching - Interactive Debug Script
 * 
 * This script tests mode switching functionality
 */

import { readFileSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'

console.log("🔍 Testing Mode Switching...")

// Start gizzi-code
const child = spawn('bun', ['run', '--conditions=browser', './src/cli/main.ts', '.', '--print-logs'], {
  cwd: process.cwd(),
  env: { ...process.env, GIZZI_ROUTE: '{"type":"home"}' }
})

let output = ''
let modeChanged = false

child.stdout.on('data', (data) => {
  const text = data.toString()
  output += text
  
  // Check for mode-related logs
  if (text.includes('Mode') || text.includes('mode') || text.includes('cowork') || text.includes('Cowork')) {
    console.log("📝 Found mode-related output:")
    console.log(text)
    modeChanged = true
  }
  
  // Check for route changes
  if (text.includes('route') || text.includes('Route') || text.includes('navigate')) {
    console.log("🛣️ Found route-related output:")
    console.log(text)
  }
})

child.stderr.on('data', (data) => {
  const text = data.toString()
  output += text
  if (text.includes('error') || text.includes('Error') || text.includes('ERROR')) {
    console.log("❌ Error found:")
    console.log(text)
  }
})

// After 5 seconds, check what we got
setTimeout(() => {
  child.kill()
  
  console.log("\n=== Test Results ===")
  console.log("Total output length:", output.length)
  console.log("Mode changed:", modeChanged ? "YES ✅" : "NO ❌")
  
  // Save full output
  writeFileSync('/tmp/mode-test-output.txt', output)
  console.log("\nFull output saved to: /tmp/mode-test-output.txt")
  
  if (!modeChanged) {
    console.log("\n❌ Mode switching is NOT working!")
    console.log("Check /tmp/mode-test-output.txt for details")
  } else {
    console.log("\n✅ Mode switching IS working!")
  }
  
  process.exit(modeChanged ? 0 : 1)
}, 5000)

console.log("⏳ Waiting for output...")
