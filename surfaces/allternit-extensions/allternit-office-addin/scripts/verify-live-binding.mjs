const host = process.argv.slice(2).find((argument) => ['word', 'excel', 'powerpoint'].includes(argument))
if (!host) {
  console.error('Usage: pnpm test:binding -- word|excel|powerpoint')
  process.exit(2)
}

const gateway = (process.env.ALLTERNIT_GATEWAY_URL || 'http://127.0.0.1:8013').replace(/\/+$/, '')
const timeoutMs = Number(process.env.ALLTERNIT_BINDING_TIMEOUT_MS || 60_000)
const token = process.env.ALLTERNIT_AUTH_TOKEN
const startedAt = Date.now()
let lastReason = 'No binding response received.'

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(`${gateway}/api/v1/office/bindings`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) {
      lastReason = `Gateway returned HTTP ${response.status}.`
    } else {
      const payload = await response.json()
      const bindings = Array.isArray(payload.bindings) ? payload.bindings : []
      const binding = bindings.find((candidate) => candidate.host === host)
      if (!binding) lastReason = `Gateway is reachable, but no ${host} binding exists.`
      else if (binding.connected === false) lastReason = `${host} binding exists but reports disconnected.`
      else if ((binding.active_session_count ?? 0) < 1) lastReason = `${host} binding has no active Office session.`
      else {
        console.log(`Live ${host} Office binding verified.`)
        console.log(`- binding: ${binding.id}`)
        console.log(`- document: ${binding.title || binding.label || 'untitled'}`)
        console.log(`- active sessions: ${binding.active_session_count}`)
        if (binding.workspace_id) console.log(`- workspace: ${binding.workspace_id}`)
        if (binding.project_id) console.log(`- project: ${binding.project_id}`)
        process.exit(0)
      }
    }
  } catch (error) {
    lastReason = error instanceof Error ? error.message : String(error)
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000))
}

console.error(`Live ${host} binding verification timed out after ${timeoutMs}ms.`)
console.error(lastReason)
process.exit(1)
