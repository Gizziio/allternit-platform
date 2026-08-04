import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import {
  apiFetchJson,
  getAllternitApiConfig,
} from "@/runtime/services/api/allternitApi"

interface UdemyCourse {
  id: number
  title: string
  headline: string
  url: string
  rating: number
  num_reviews: number
  num_subscribers: number
  price: string
  is_paid: boolean
  level: string
  num_lectures: number
}

interface SearchResponse {
  count: number
  results: UdemyCourse[]
}

const CATEGORIES = [
  { tier: "CORE", label: "AI Reasoning & Prompt Engineering", query: "prompt engineering" },
  { tier: "CORE", label: "Multimodal AI Workflows", query: "multimodal AI" },
  { tier: "CORE", label: "AI Evaluation & Trust", query: "AI evaluation" },
  { tier: "OPS", label: "AI Workflow Design", query: "AI workflow automation" },
  { tier: "OPS", label: "Research Operations", query: "AI research" },
  { tier: "OPS", label: "Content Operations", query: "AI content generation" },
  { tier: "OPS", label: "Knowledge Management", query: "knowledge management AI" },
  { tier: "AGENTS", label: "RAG & Document Intelligence", query: "RAG AI" },
  { tier: "AGENTS", label: "Multi-Agent Orchestration", query: "multi-agent AI" },
  { tier: "AGENTS", label: "AI Copilot & Code Generation", query: "AI coding assistant" },
  { tier: "AGENTS", label: "Web Research Agent", query: "web scraping Python" },
  { tier: "AGENTS", label: "Knowledge Base Assistant", query: "chatbot knowledge base" },
]

export const UdemyCommand = cmd({
  command: "udemy [action]",
  describe: "Search the Udemy public course catalog",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["categories", "search"],
        describe: "Browse categories or run a search",
        default: "categories",
      })
      .option("query", {
        type: "string",
        alias: "q",
        describe: "Search query (for search action)",
      })
      .option("price", {
        type: "string",
        choices: ["free", "paid", "all"],
        default: "free",
        describe: "Price filter",
      })
      .option("level", {
        type: "string",
        choices: ["Beginner", "Intermediate", "Expert"],
        describe: "Level filter",
      }),

  handler: async (args) => {
    const action = args.action as "categories" | "search"
    const config = getAllternitApiConfig()

    if (action === "categories") {
      UI.println(UI.Style.TEXT_INFO_BOLD + "Udemy Catalog — A://Labs Categories" + UI.Style.RESET)
      UI.empty()
      let currentTier = ""
      for (const cat of CATEGORIES) {
        if (cat.tier !== currentTier) {
          currentTier = cat.tier
          UI.println(UI.Style.TEXT_NORMAL_BOLD + currentTier + UI.Style.RESET)
        }
        UI.println(`  ${UI.Style.TEXT_HIGHLIGHT}${cat.label}${UI.Style.RESET}`)
        UI.println(`    ${UI.Style.TEXT_DIM}Try: gizzi udemy search -q "${cat.query}"${UI.Style.RESET}`)
      }
      return
    }

    const query = (args.query as string | undefined)?.trim()
    if (!query) {
      UI.println(UI.Style.TEXT_ERROR + "❌ Search requires --query or -q" + UI.Style.RESET)
      process.exitCode = 1
      return
    }

    const body: Record<string, unknown> = {
      query,
      price: args.price,
      page: 1,
      page_size: 20,
    }
    if (args.level) {
      body.level = args.level
    }

    try {
      const data = await apiFetchJson<SearchResponse>(config, "/udemy/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (data.results.length === 0) {
        UI.println(UI.Style.TEXT_INFO + "No courses found." + UI.Style.RESET)
        return
      }

      UI.println(UI.Style.TEXT_INFO_BOLD + `Udemy — ${data.count} result(s)` + UI.Style.RESET)
      UI.empty()
      for (const course of data.results) {
        const priceLabel = course.is_paid ? course.price : `${UI.Style.TEXT_SUCCESS}Free${UI.Style.RESET}`
        const rating = course.rating ? ` · ⭐ ${course.rating.toFixed(1)}` : ""
        UI.println(`  ${UI.Style.TEXT_NORMAL_BOLD}${course.title}${UI.Style.RESET}`)
        UI.println(`    ${UI.Style.TEXT_DIM}${course.headline}${UI.Style.RESET}`)
        UI.println(`    ${priceLabel}${rating} · ${course.level} · ${course.num_reviews} reviews`)
        UI.println(`    ${UI.Style.TEXT_DIM}https://www.udemy.com${course.url}${UI.Style.RESET}`)
        UI.empty()
      }
    } catch (err: any) {
      UI.println(UI.Style.TEXT_ERROR + `❌ Search failed: ${err.message}` + UI.Style.RESET)
      process.exitCode = 1
    }
  },
})
