import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { BrainService } from "@/runtime/brain/brain.service"
import { Log } from "@/shared/util/log"
import { getSessionId } from "@/bootstrap/state"

const log = Log.create({ service: "brain-cli" })

function getTenantId(): string {
  try {
    const id = getSessionId()
    return id ? String(id) : "default"
  } catch {
    return "default"
  }
}

export const BrainCommand = cmd({
  command: "brain [action]",
  describe: "Brain integration — persistent knowledge and memory",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["status", "remember", "recall", "entities", "sync", "forget"],
        describe: "Brain action",
        default: "status",
      })
      .option("text", {
        type: "string",
        alias: "t",
        describe: "Text content (for remember/recall)",
      })
      .option("type", {
        type: "string",
        choices: ["episodic", "semantic", "procedural"],
        describe: "Memory type",
        default: "semantic",
      })
      .option("importance", {
        type: "number",
        describe: "Importance 1-10",
        default: 5,
      })
      .option("id", {
        type: "string",
        describe: "Memory/entity ID (for forget)",
      })
      .option("limit", {
        type: "number",
        alias: "n",
        describe: "Result limit",
        default: 10,
      })
      .example("gizzi brain status", "Show brain statistics")
      .example('gizzi brain remember -t "Redis runs on port 6379" --importance 8', "Store a fact")
      .example('gizzi brain recall -t "Redis"', "Search memories")
      .example("gizzi brain entities", "List known entities")
      .example("gizzi brain sync", "Sync BRAIN.md from database"),

  handler: async (args) => {
    const action = args.action as "status" | "remember" | "recall" | "entities" | "sync" | "forget"
    const tenantId = getTenantId()

    try {
      switch (action) {
        case "status": {
          const stats = BrainService.stats(tenantId)
          UI.println(UI.Style.TEXT_INFO_BOLD + "🧠 Brain Status" + UI.Style.RESET)
          UI.println(`  Total memories: ${stats.total_memories}`)
          UI.println(`  Episodic:       ${stats.episodic}`)
          UI.println(`  Semantic:       ${stats.semantic}`)
          UI.println(`  Procedural:     ${stats.procedural}`)
          UI.println(`  Entities:       ${stats.entities}`)
          UI.println(`  Relations:      ${stats.relations}`)

          const brainMd = await BrainService.readBrainMd()
          if (brainMd) {
            UI.println(UI.Style.TEXT_SUCCESS + "  BRAIN.md:       present" + UI.Style.RESET)
          } else {
            UI.println(UI.Style.TEXT_WARNING + "  BRAIN.md:       not found (run `gizzi brain sync`)" + UI.Style.RESET)
          }
          break
        }

        case "remember": {
          if (!args.text) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No text provided. Use --text or -t" + UI.Style.RESET)
            process.exit(1)
          }
          const mem = BrainService.createChunk(tenantId, {
            chunk_type: args.type as any,
            content: args.text,
            importance: args.importance,
          })
          UI.println(UI.Style.TEXT_SUCCESS + `✅ Remembered: ${mem.id}` + UI.Style.RESET)
          UI.println(`  Type: ${mem.chunk_type} | Importance: ${mem.importance}`)
          break
        }

        case "recall": {
          const memories = BrainService.queryChunks({
            tenant_id: tenantId,
            query: args.text,
            limit: args.limit,
          })

          if (memories.length === 0) {
            UI.println(UI.Style.TEXT_WARNING + "🔍 No memories found" + UI.Style.RESET)
            return
          }

          UI.println(UI.Style.TEXT_INFO_BOLD + `🔍 ${memories.length} Memories` + UI.Style.RESET)
          for (const mem of memories) {
            const color =
              mem.chunk_type === "episodic"
                ? UI.Style.TEXT_INFO
                : mem.chunk_type === "semantic"
                  ? UI.Style.TEXT_SUCCESS
                  : UI.Style.TEXT_WARNING
            const date = new Date(mem.time_created).toLocaleString()
            UI.println(`  ${color}[${mem.chunk_type}]${UI.Style.RESET} ${mem.content.slice(0, 60)}${mem.content.length > 60 ? "..." : ""}`)
            UI.println(`     ID: ${mem.id} | Importance: ${mem.importance} | ${date}`)
          }
          break
        }

        case "entities": {
          const entities = BrainService.queryEntities(tenantId)
          if (entities.length === 0) {
            UI.println(UI.Style.TEXT_WARNING + "🔍 No entities found" + UI.Style.RESET)
            return
          }

          UI.println(UI.Style.TEXT_INFO_BOLD + `🔍 ${entities.length} Entities` + UI.Style.RESET)
          for (const e of entities) {
            UI.println(`  ${e.name} (${e.entity_type}) — ${e.description ?? "no description"}`)
            const related = BrainService.getRelated(tenantId, e.id)
            for (const r of related) {
              UI.println(`    → ${r.predicate} → ${r.entity.name}`)
            }
          }
          break
        }

        case "sync": {
          UI.println(UI.Style.TEXT_INFO + "🔄 Syncing BRAIN.md..." + UI.Style.RESET)
          const content = await BrainService.syncBrainMd(tenantId)
          UI.println(UI.Style.TEXT_SUCCESS + "✅ BRAIN.md synced" + UI.Style.RESET)
          UI.println(content.slice(0, 500))
          if (content.length > 500) UI.println("...")
          break
        }

        case "forget": {
          if (!args.id) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No ID provided. Use --id" + UI.Style.RESET)
            process.exit(1)
          }
          BrainService.deleteChunk(args.id)
          UI.println(UI.Style.TEXT_SUCCESS + `✅ Forgotten: ${args.id}` + UI.Style.RESET)
          break
        }
      }
    } catch (err: any) {
      log.error("brain command failed", { action, error: err.message })
      UI.println(UI.Style.TEXT_ERROR + `❌ Error: ${err.message}` + UI.Style.RESET)
      process.exit(1)
    }
  },
})
