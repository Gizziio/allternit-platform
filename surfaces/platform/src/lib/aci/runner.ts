/**
 * ACI Agent Run Loop
 *
 * Orchestrates: screenshot → model → risk classify → (approve?) → execute → repeat
 *
 * State machine:
 *   Idle → Running → (WaitingApproval ↔ Running) → Done | Error | Stopped
 *
 * All state changes are broadcast via SSE to subscribers.
 */

import type { AciAction, RunSession, RunState, SseEvent } from './types';
import { classifyRisk, requiresApproval } from './risk';
import { executeAction, fetchScreenshot } from './executor';
import { broadcast, destroySession } from './session-store';

/** Terminal states — session is eligible for cleanup after this TTL */
const TERMINAL_STATES: ReadonlySet<RunState['status']> = new Set(['Done', 'Error', 'Stopped']);
const SESSION_TTL_MS = 5 * 60_000; // 5 minutes: enough for UI to consume final state

const MAX_STEPS = 50;        // Safety cap — stop runaway agents
const STEP_DELAY_MS = 400;   // Breathing room between steps

// ─────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────

export async function startRun(session: RunSession): Promise<void> {
  const { abortController } = session;
  const signal = abortController.signal;

  emitState(session, { status: 'Running', lastMessage: 'Starting…' });

  try {
    const history: AciAction[] = [];

    for (let step = 1; step <= MAX_STEPS; step++) {
      if (signal.aborted) break;

      // 1. Fetch screenshot
      const screenshotB64 = await fetchScreenshot(signal);
      if (!screenshotB64) {
        emitState(session, {
          status: 'Error',
          error: 'Could not reach computer-use service — is it running on port 3010?',
        });
        return;
      }

      // Broadcast screenshot frame so the UI updates immediately
      emitScreenshot(session, screenshotB64);

      // 2. Ask model for next action(s)
      let actions: AciAction[] | null;
      try {
        actions = await session.adapter.step({
          goal: session.goal,
          screenshotB64,
          history,
          lastResult: history.at(-1) ?? undefined,
        });
      } catch (err) {
        if (signal.aborted) break;
        emitState(session, {
          status: 'Error',
          error: `Model error: ${(err as Error).message}`,
        });
        return;
      }

      // null → model signals done
      if (!actions || actions.length === 0) {
        emitState(session, {
          status: 'Done',
          lastMessage: 'Task complete',
          stepIndex: step,
          receipts: session.state.receipts,
        });
        return;
      }

      // 3. Execute each action in the batch
      for (const action of actions) {
        if (signal.aborted) break;

        // Classify risk
        const tier = classifyRisk(action);
        const enriched: AciAction = { ...action, risk: tier };

        // T3+ → pause and wait for approval
        if (requiresApproval(tier)) {
          session.pendingAction = enriched;

          let resolveApproval!: (approved: boolean) => void;
          session.approvalPromise = new Promise<boolean>((res) => {
            resolveApproval = res;
          });
          session.approvalResolve = resolveApproval;

          emitState(session, {
            status: 'WaitingApproval',
            currentAction: enriched,
            stepIndex: step,
            lastMessage: `Approval required: ${enriched.label ?? enriched.type}`,
          });

          // Wait for user to approve or deny (or abort)
          const approved = await Promise.race([
            session.approvalPromise,
            new Promise<boolean>((_, reject) => {
              signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            }),
          ]).catch(() => false);

          session.pendingAction = null;
          session.approvalPromise = null;
          session.approvalResolve = null;

          if (!approved) {
            if (signal.aborted) break;
            emitState(session, {
              status: 'Running',
              currentAction: null,
              lastMessage: 'Action denied — continuing…',
            });
            continue;
          }

          emitState(session, {
            status: 'Running',
            currentAction: enriched,
            lastMessage: `Executing: ${enriched.label ?? enriched.type}`,
          });
        } else {
          emitState(session, {
            status: 'Running',
            currentAction: enriched,
            stepIndex: step,
            lastMessage: enriched.label ?? enriched.type,
          });
        }

        // 4. Execute
        if (enriched.type !== 'done') {
          const result = await executeAction(enriched, signal).catch((err) => {
            if ((err as Error).name === 'AbortError') return null;
            return { status: 'failed' as const, error: (err as Error).message };
          });

          if (!result) break; // aborted

          if (result.status === 'failed' && result.error) {
            emitTrace(session, `⚠ Action failed: ${result.error}`);
          } else {
            session.state.receipts++;
            emitTrace(session, `✓ ${enriched.label ?? enriched.type}`);
          }
        }

        history.push(enriched);

        // Small delay between actions
        if (!signal.aborted) {
          await new Promise<void>((res) => setTimeout(res, STEP_DELAY_MS));
        }
      }

      if (signal.aborted) break;
    }

    // Reached MAX_STEPS
    if (!signal.aborted) {
      emitState(session, {
        status: 'Done',
        lastMessage: `Reached step limit (${MAX_STEPS})`,
      });
    }
  } catch (err) {
    if (signal.aborted) {
      emitState(session, { status: 'Stopped', lastMessage: 'Stopped by user' });
    } else {
      emitState(session, {
        status: 'Error',
        error: (err as Error).message,
      });
    }
  }
}

/**
 * Approve the currently pending action.
 * Returns false if there is no pending action.
 */
export function approveAction(session: RunSession): boolean {
  if (!session.approvalResolve) return false;
  session.approvalResolve(true);
  return true;
}

/**
 * Deny the currently pending action.
 */
export function denyAction(session: RunSession): boolean {
  if (!session.approvalResolve) return false;
  session.approvalResolve(false);
  return true;
}

// ─────────────────────────────────────────────────────────────
// SSE helpers
// ─────────────────────────────────────────────────────────────

function emitState(session: RunSession, patch: Partial<RunState>): void {
  Object.assign(session.state, {
    ...patch,
    elapsedMs: Date.now() - session.startedAt,
  });
  const event: SseEvent = {
    type: 'state',
    data: { ...session.state },
    ts: Date.now(),
  };
  broadcast(session.sessionId, event);

  // Schedule cleanup after terminal states so the session doesn't leak memory.
  if (patch.status && TERMINAL_STATES.has(patch.status)) {
    const { sessionId } = session;
    setTimeout(() => destroySession(sessionId), SESSION_TTL_MS);
  }
}

function emitScreenshot(session: RunSession, screenshotB64: string): void {
  session.state.screenshot = screenshotB64;
  broadcast(session.sessionId, {
    type: 'screenshot',
    data: { screenshot: screenshotB64 },
    ts: Date.now(),
  });
}

function emitTrace(session: RunSession, message: string): void {
  broadcast(session.sessionId, {
    type: 'trace',
    data: { message },
    ts: Date.now(),
  });
}
