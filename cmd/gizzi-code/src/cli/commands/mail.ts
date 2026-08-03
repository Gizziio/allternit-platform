/**
 * Agent Activity — `gizzi mail` (Rails Mail CLI, phase 1).
 *
 * A read-capable CLI surface for the same Rails Mail backend
 * `runtime/server/rails-bridge.ts` already writes to
 * (`cmd/allternit-api/src/rails/mod.rs`). This is a genuinely different
 * system from `gizzi ac` (`AgentWorkspaceCommunication`, a separate local
 * channel-based agent-messaging system) — see `docs/AGENT_ACTIVITY_CLI_MAP.md`.
 */

import { cmd } from "@/cli/commands/cmd"
import { formatRelativeTimeAgo } from "@/shared/utils/format"
import { decide, listThreads, readThread, sendMessage, tailLedger, type LedgerEvent } from "@/cli/rails-mail-client"

const LEDGER_TAIL_COUNT = 200
const RELEVANT_EVENT_WINDOW = 4

function relatedThreadId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const record = payload as Record<string, unknown>
  if (typeof record.thread_id === "string") return record.thread_id
  if (typeof record.mail_thread_id === "string") return record.mail_thread_id
  return undefined
}

/**
 * Same heuristic web/iOS already use (AGENT_ACTIVITY_WEB_PHASE_1_NOTES.md,
 * AgentActivityStore.deriveThreadStates): substring match on `event_type`
 * against /guard/i, /reserve/i, /review/i, /decide/i, windowed to the last 4
 * ledger events related to this thread (by `payload.thread_id`/
 * `mail_thread_id`). "Review pending" if the most recent /review/i match in
 * the window postdates the most recent /decide/i match (or there is no
 * /decide/i match at all in the window). Read-only — no structured
 * reservation/guard schema exists server-side, same finding both prior
 * phases already made.
 */
function guardReviewTags(threadId: string, events: LedgerEvent[]): string[] {
  const relevant = events.filter((e) => relatedThreadId(e.payload) === threadId)
  const windowed = relevant.slice(-RELEVANT_EVENT_WINDOW)

  const tags: string[] = []
  if (windowed.some((e) => /guard/i.test(e.event_type))) tags.push("⚠ guard activity")
  if (windowed.some((e) => /reserve/i.test(e.event_type))) tags.push("🔒 reservation activity")

  let lastReviewIndex = -1
  let lastDecideIndex = -1
  windowed.forEach((e, index) => {
    if (/review/i.test(e.event_type)) lastReviewIndex = index
    if (/decide/i.test(e.event_type)) lastDecideIndex = index
  })
  if (lastReviewIndex !== -1 && (lastDecideIndex === -1 || lastDecideIndex < lastReviewIndex)) {
    tags.push("❓ review pending")
  }

  return tags
}

function formatBody(body: unknown): string {
  return typeof body === "string" ? body : JSON.stringify(body)
}

export const MailCommand = cmd({
  command: "mail",
  describe: "Agent Activity — Rails Mail threads (agent review/decision inbox)",
  builder: (yargs) =>
    yargs
      .command(
        "list",
        "List Rails Mail threads",
        () => {},
        async () => {
          try {
            const threads = await listThreads()
            console.log(`📬 Threads (${threads.length}):`)
            for (const thread of threads) {
              const lastActivity = formatRelativeTimeAgo(new Date(thread.last_ts), { style: "short" })
              console.log(`   ${thread.thread_id} — ${thread.messages} messages — ${lastActivity}`)
            }
            process.exit(0)
          } catch (err) {
            console.error(`❌ ${(err as Error).message}`)
            process.exit(1)
          }
        },
      )
      .command(
        "read <threadId>",
        "Read messages in a Rails Mail thread",
        (yargs) =>
          yargs.positional("threadId", {
            type: "string",
            describe: "Thread ID",
            demandOption: true,
          }),
        async (argv) => {
          try {
            const threadId = argv.threadId as string
            const messages = await readThread(threadId)
            console.log(`📬 ${threadId} (${messages.length} messages):`)
            for (const message of messages) {
              console.log(`   [${message.timestamp}] ${message.from_agent} (${message.event_type}):`)
              console.log(`     ${formatBody(message.body)}`)
            }

            const ledgerEvents = await tailLedger(LEDGER_TAIL_COUNT)
            const tags = guardReviewTags(threadId, ledgerEvents)
            for (const tag of tags) {
              console.log(`   ${tag}`)
            }
            process.exit(0)
          } catch (err) {
            console.error(`❌ ${(err as Error).message}`)
            process.exit(1)
          }
        },
      )
      .command(
        "send <threadId> <body>",
        "Send a message to a Rails Mail thread",
        (yargs) =>
          yargs
            .positional("threadId", {
              type: "string",
              describe: "Thread ID",
              demandOption: true,
            })
            .positional("body", {
              type: "string",
              describe: "Message body",
              demandOption: true,
            }),
        async (argv) => {
          try {
            const result = await sendMessage(argv.threadId as string, argv.body as string)
            console.log(`✅ Message sent to ${result.thread_id}`)
            process.exit(0)
          } catch (err) {
            console.error(`❌ ${(err as Error).message}`)
            process.exit(1)
          }
        },
      )
      .command(
        "decide <threadId>",
        "Approve or reject a pending review for a Rails Mail thread",
        (yargs) =>
          yargs
            .positional("threadId", {
              type: "string",
              describe: "Thread ID",
              demandOption: true,
            })
            .option("approve", {
              type: "boolean",
              describe: "Approve the pending review",
            })
            .option("reject", {
              type: "boolean",
              describe: "Reject the pending review",
            }),
        async (argv) => {
          try {
            // Validated here, not via yargs `.check()`/`.conflicts()`: a
            // thrown `.check()` validator is caught by yargs' own error
            // path, which this app's global handler reports but never
            // exits the process for — the command hangs forever. Keeping
            // validation inside this try/catch guarantees the process.exit
            // below always runs.
            if (argv.approve !== undefined && argv.reject !== undefined) {
              throw new Error("--approve and --reject are mutually exclusive")
            }
            if (argv.approve === undefined && argv.reject === undefined) {
              throw new Error("one of --approve or --reject is required")
            }
            const approve = argv.approve === true
            const result = await decide(argv.threadId as string, approve)
            console.log(`✅ Thread ${result.thread_id} ${approve ? "approved" : "rejected"}`)
            process.exit(0)
          } catch (err) {
            console.error(`❌ ${(err as Error).message}`)
            process.exit(1)
          }
        },
      )
      .demandCommand(1),
  handler: async () => {},
})
