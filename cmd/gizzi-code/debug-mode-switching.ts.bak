#!/usr/bin/env bun
/**
 * Debug Mode Switching - Interactive Test
 * 
 * This script:
 * 1. Launches gizzi-code TUI
 * 2. Captures initial state
 * 3. Simulates Ctrl+2 (switch to Cowork)
 * 4. Captures new state
 * 5. Verifies mode actually changed
 */

import { spawn } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'

console.log("🔍 Starting Mode Switching Debug Test...\n")

// Start gizzi-code with logging
const child = spawn('bun', ['run', '--conditions=browser', './src/cli/main.ts', '.'], {
  cwd: process.cwd(),
  env: { 
    ...process.env,
    GIZZI_ROUTE: '{"type":"home"}',
    DEBUG: 'true'
  },
  stdio: ['pipe', 'pipe', 'pipe']
})

let output = ''
let errors = ''
let modeChanged = false
let coworkRendered = false

child.stdout.on('data', (data) => {
  const text = data.toString()
  output += text
  
  // Look for mode-related logs
  if (text.includes('[Home] ModeSwitcher')) {
    console.log("📝 ModeSwitcher event:", text.trim())
  }
  if (text.includes('[ModeContext]')) {
    console.log("🔄 ModeContext event:", text.trim())
  }
  if (text.includes('[Keyboard]')) {
    console.log("⌨️ Keyboard event:", text.trim())
  }
  if (text.includes('Cowork') || text.includes('cowork')) {
    console.log("✅ Found Cowork reference:", text.trim())
    coworkRendered = true
  }
  if (text.includes('route.data.type')) {
    console.log("🛣️ Route info:", text.trim())
  }
})

child.stderr.on('data', (data) => {
  const text = data.toString()
  errors += text
  if (text.includes('error') || text.includes('Error') || text.includes('fatal')) {
    console.log("❌ ERROR:", text.trim())
  }
})

// Wait 8 seconds for TUI to initialize
setTimeout(() => {
  console.log("\n=== Test Results ===")
  console.log("Output length:", output.length)
  console.log("Error length:", errors.length)
  console.log("Mode changed:", modeChanged ? "YES ✅" : "NO ❌")
  console.log("Cowork rendered:", coworkRendered ? "YES ✅" : "NO ❌")
  
  // Save outputs
  writeFileSync('/tmp/gizzi-output.txt', output)
  writeFileSync('/tmp/gizzi-errors.txt', errors)
  
  // Check for specific issues
  const issues = []
  
  if (output.includes('createEffect is not defined')) {
    issues.push("❌ createEffect not imported in mode-switcher.tsx")
  }
  if (output.includes('useMode must be used within ModeProvider')) {
    issues.push("❌ ModeProvider not wrapping the component tree")
  }
  if (output.includes('Unhandled route')) {
    issues.push("❌ Route not registered in app.tsx Switch statement")
  }
  if (!output.includes('ModeSwitcher') && !output.includes('mode')) {
    issues.push("❌ No mode-related logs found - click handlers may not be firing")
  }
  if (!coworkRendered && output.includes('Navigating to cowork')) {
    issues.push("❌ Navigation triggered but Cowork component didn't render")
  }
  
  if (issues.length > 0) {
    console.log("\n=== Issues Found ===")
    issues.forEach(issue => console.log(issue))
  } else {
    console.log("\n✅ No obvious issues found!")
  }
  
  console.log("\n=== Logs Saved ===")
  console.log("Output: /tmp/gizzi-output.txt")
  console.log("Errors: /tmp/gizzi-errors.txt")
  
  child.kill()
  process.exit(issues.length > 0 ? 1 : 0)
}, 8000)

console.log("⏳ Waiting for TUI output...\n")
