// §A2/Critical #2 — crash recovery for sent_unconfirmed attempts: every one
// goes through adapter.reconcile(); blind resubmit is forbidden. A missing
// adapter or missing reconcile fn is treated as ambiguous (never resubmitted).
import type {
  ExecutionContext,
  SubscriptionAdapter,
  TaskAttempt,
  TaskError,
} from "@allternit/subscription-fabric-contracts";
import type { EventLog } from "../events/log.js";
import type { Db } from "../store/db.js";
import {
  getTask,
  listAttemptsBySubmissionState,
  updateAttempt,
  updateTaskStatus,
} from "../store/queries.js";

export type AdapterLookup = (adapterId: string) => SubscriptionAdapter | undefined;

export interface ReconcileDeps {
  log?: EventLog;
  // Real workers hand in a watch-page context; tests may omit it when the
  // fake adapter's reconcile ignores ctx.
  makeCtx?: (attempt: TaskAttempt, adapter: SubscriptionAdapter) => ExecutionContext;
  // §A8 — scope the sweep to one worker key (provider, account_id). Attempts
  // whose adapter is missing are included when the account matches (they take
  // the ambiguous path, which needs no adapter).
  filter?: { provider: string; account_id: string };
}

function ambiguousTaskError(detail: string): TaskError {
  return {
    class: "submission_ambiguous",
    scope: "task",
    retryable: false,
    fallback_eligible: false,
    cooldown_s: null,
    user_action: "Check the provider thread, then retry manually if absent",
    detail,
    evidence_ref: null,
  };
}

export async function reconcileAttempts(
  db: Db,
  adapters: AdapterLookup,
  deps: ReconcileDeps = {}
): Promise<void> {
  const pending = listAttemptsBySubmissionState(db, "sent_unconfirmed");

  for (const { task_id, attempt } of pending) {
    const task = getTask(db, task_id);
    if (!task) continue;
    const adapter = adapters(attempt.adapter_id);
    if (deps.filter) {
      if (attempt.account_id !== deps.filter.account_id) continue;
      if (adapter && adapter.manifest.provider !== deps.filter.provider) continue;
    }
    const now = new Date().toISOString();

    const statusEvent = (status: string, detail?: string): void => {
      deps.log?.append({
        task_id,
        kind: "task.status",
        payload: { task_id, status, thread_id: task.thread_id, detail },
        callers: [task.requester.id],
      });
    };

    if (!adapter || typeof adapter.reconcile !== "function" || !deps.makeCtx) {
      // No way to confirm — ambiguous, never resubmit.
      updateAttempt(db, task_id, attempt.attempt_no, { outcome: "ambiguous", ended_at: now });
      updateTaskStatus(db, task_id, "needs_user", {
        statusDetail: "submission outcome could not be reconciled (no reconcile path)",
      });
      statusEvent("needs_user", "reconcile unavailable");
      continue;
    }

    const result = await adapter.reconcile(attempt, deps.makeCtx(attempt, adapter));

    switch (result.outcome) {
      case "acknowledged":
        // The provider has it — adopt and resume; do not resubmit.
        updateAttempt(db, task_id, attempt.attempt_no, {
          submission_state: "acknowledged",
          provider_thread_id: result.provider_thread_id ?? attempt.provider_thread_id,
        });
        updateTaskStatus(db, task_id, "running", {
          statusDetail: "adopted after reconcile",
        });
        statusEvent("running", "reconcile: acknowledged");
        break;
      case "duplicate":
        // Our earlier submit already landed — adopt the thread, never resubmit.
        updateAttempt(db, task_id, attempt.attempt_no, {
          submission_state: "acknowledged",
          provider_thread_id: result.provider_thread_id ?? attempt.provider_thread_id,
        });
        updateTaskStatus(db, task_id, "running", {
          statusDetail: "duplicate submission adopted after reconcile",
        });
        statusEvent("running", "reconcile: duplicate adopted");
        break;
      case "not_found": {
        const error = ambiguousTaskError(
          result.detail ?? "provider has no thread matching this attempt"
        );
        updateAttempt(db, task_id, attempt.attempt_no, {
          outcome: "ambiguous",
          ended_at: now,
          error,
        });
        updateTaskStatus(db, task_id, "failed", { error, completedAt: now });
        statusEvent("failed", "reconcile: not_found");
        break;
      }
      case "ambiguous":
        updateAttempt(db, task_id, attempt.attempt_no, { outcome: "ambiguous", ended_at: now });
        updateTaskStatus(db, task_id, "needs_user", {
          statusDetail: result.detail ?? "submission outcome ambiguous — manual check required",
        });
        statusEvent("needs_user", "reconcile: ambiguous");
        break;
    }
  }
}
