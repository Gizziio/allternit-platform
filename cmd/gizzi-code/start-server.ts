#!/usr/bin/env bun
/**
 * Simple HTTP Server for Web Proxy
 * Starts just the HTTP server without TUI
 */

import { Server } from "./src/runtime/server/server"
import { Flag } from "./src/runtime/context/flag/flag"

// Set required flags
Flag.GIZZI_SERVER_PASSWORD = ""

console.log("Starting A2R HTTP Server on port 4096...")

const server = Server.listen({
  port: 4096,
  hostname: "127.0.0.1",
})

console.log(`Server listening on http://127.0.0.1:4096`)
console.log(`Web proxy available at http://127.0.0.1:4096/web-proxy?url=<encoded-url>`)

// Keep the server running
await new Promise(() => {})
