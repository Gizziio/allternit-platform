/**
 * Live verification: gizzi-code computerUse engine adapter ↔ real ACU gateway.
 *
 * Boots no servers itself — expects the Python gateway on ACU_GATEWAY_URL
 * (default http://127.0.0.1:8986) with a healthy page-scoped adapter
 * (browser.cdp). Actions execute inside the Chrome page via CDP, never at
 * the OS input layer, so this is safe to run on a live desktop.
 *
 * Run from the repo root:
 *   npx tsx cmd/gizzi-code/script/verify-engine-adapter-live.ts
 */
// Resolved by relative path so the script exercises the SDK source directly
// (dist/ is not tracked; `pnpm --filter @allternit/computer-use build` makes
// the package export work too).
import { AllternitComputerUseClient } from '../../../sdk/computer-use/src/index.js'
import { createEngineExecutor } from '../src/cli/ui/ink-app/utils/computerUse/engine/executor.js'

const ENDPOINT = process.env.ACU_GATEWAY_URL ?? 'http://127.0.0.1:8986'

interface Check {
  name: string
  passed: boolean
  detail: string
}

const checks: Check[] = []
function report(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name} — ${detail}`)
}

async function expectResolve(
  name: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn()
    report(name, true, 'resolved without error')
  } catch (err) {
    report(name, false, `threw: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function expectReject(
  name: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn()
    report(name, false, 'resolved but an honest failure was expected')
  } catch (err) {
    report(name, true, `honest error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function main(): Promise<void> {
  console.log(`gateway: ${ENDPOINT}`)
  const client = new AllternitComputerUseClient({ endpoint: ENDPOINT })

  // ── 1. Raw client path: executeDirect with engine-native action kinds ────
  const direct = await client.executeDirect([
    { kind: 'type', action_id: 'live-type', input: { text: 'cu11 live' } },
    { kind: 'scroll', action_id: 'live-scroll', target: { x: 100, y: 100 }, input: { delta_x: 0, delta_y: 120 } },
    { kind: 'wait', action_id: 'live-wait', input: { ms: 100 } },
  ])
  interface LiveActionOutcome {
    action_id: string
    status: string
    error: string | null
    result?: { status?: string; error?: { message?: string } | null }
  }
  const directResult = direct.result as { actions?: LiveActionOutcome[] } | null
  const outcomes = directResult?.actions ?? []
  report(
    'client.executeDirect run completed',
    direct.status === 'completed',
    `run status=${direct.status} error=${JSON.stringify(direct.error ?? null)}`,
  )
  for (const expected of ['live-type', 'live-scroll', 'live-wait']) {
    const outcome = outcomes.find((o) => o.action_id === expected)
    if (!outcome) {
      report(`per-action outcome present (${expected})`, false, 'missing from result.actions')
      continue
    }
    const envelopeStatus = outcome.result?.status
    const envelopeError = outcome.result?.error?.message ?? null
    const ok = outcome.status === 'ok' && envelopeStatus !== 'failed'
    report(
      `per-action outcome (${expected})`,
      ok,
      `entry=${outcome.status} envelope=${envelopeStatus ?? 'n/a'}${envelopeError ? ` err="${envelopeError}"` : ''}`,
    )
  }

  // ── 2. Engine adapter path: the actual gizzi computerUse executor ────────
  const executor = createEngineExecutor({ endpoint: ENDPOINT })

  // type (no clipboard round-trip: page-scoped keyboard via CDP)
  await expectResolve('adapter.type', () =>
    executor.type('cu11 adapter', { viaClipboard: false }),
  )

  // click + scroll through the same batching code path
  await expectResolve('adapter.click', () => executor.click(120, 120, 'left', 1))
  await expectResolve('adapter.doubleClick', () =>
    executor.click(120, 120, 'left', 2),
  )
  await expectResolve('adapter.scroll', () => executor.scroll(120, 120, 0, 100))

  // Hover has no engine equivalent — it must fail loudly, not fake success.
  await expectReject('adapter.moveMouse honest failure', () =>
    executor.moveMouse(140, 140),
  )

  // drag: engine maps to a native drag action
  await expectResolve('adapter.drag', () =>
    executor.drag({ x: 140, y: 140 }, { x: 180, y: 180 }),
  )

  // An action the engine genuinely cannot perform must fail loudly, not
  // pretend success. Display geometry is documented as not-an-engine-concept.
  await expectReject('adapter.getDisplaySize honest failure', () =>
    executor.getDisplaySize(),
  )

  // ── 3. Screenshot path (direct screenshot action → PNG dims from IHDR) ───
  try {
    const shot = await executor.screenshot({ allowedBundleIds: [] })
    const pngOk =
      shot.mimeType === 'image/png' && shot.width > 0 && shot.height > 0
    report(
      'adapter.screenshot',
      pngOk,
      `mime=${shot.mimeType} dims=${shot.width}x${shot.height}`,
    )
  } catch (err) {
    report('adapter.screenshot', false, `threw: ${err instanceof Error ? err.message : String(err)}`)
  }

  const failed = checks.filter((c) => !c.passed)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) {
    console.log('failures:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('verification crashed:', err)
  process.exitCode = 1
})
