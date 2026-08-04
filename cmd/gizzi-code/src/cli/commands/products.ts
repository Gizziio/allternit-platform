import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"

type ProductStatus = "live" | "beta" | "soon"

interface Product {
  id: string
  name: string
  description: string
  category: string
  status: ProductStatus
}

const CATEGORIES = ["Core", "AI Agents", "Create", "Infrastructure", "Surfaces", "Learn", "Ecosystem"]

const PRODUCTS: Product[] = [
  { id: "chat", name: "Chat", description: "Conversational AI for everything", category: "Core", status: "live" },
  { id: "code", name: "Allternit Code", description: "AI pair programmer in your IDE", category: "Core", status: "live" },
  { id: "cowork", name: "Cowork", description: "Collaborative AI for teams", category: "Core", status: "live" },
  { id: "computer-use", name: "Computer Use", description: "AI that sees and controls browsers", category: "AI Agents", status: "live" },
  { id: "swarm", name: "Swarm ADE", description: "Orchestrate hundreds of AI agents", category: "AI Agents", status: "live" },
  { id: "agent-hub", name: "Agent Hub", description: "Build, deploy, and manage agents", category: "AI Agents", status: "live" },
  { id: "canvas", name: "Canvas", description: "Documents built with AI", category: "Create", status: "beta" },
  { id: "design", name: "Allternit Design", description: "Visual design and creative tools", category: "Create", status: "beta" },
  { id: "workflow", name: "Workflows", description: "Visual automation and task pipelines", category: "Create", status: "beta" },
  { id: "local-brain", name: "Local Brain", description: "Private offline AI on your machine", category: "Infrastructure", status: "live" },
  { id: "cloud-deploy", name: "Cloud Deploy", description: "Deploy Allternit nodes to any cloud", category: "Infrastructure", status: "live" },
  { id: "browser", name: "Browser Capsule", description: "AI assistant in every browser tab", category: "Surfaces", status: "live" },
  { id: "desktop", name: "Desktop App", description: "Native app for macOS, Windows, Linux", category: "Surfaces", status: "live" },
  { id: "labs", name: "A://Labs", description: "AI courses — 7 live in Canvas LMS", category: "Learn", status: "live" },
  { id: "marketplace", name: "Marketplace", description: "Discover plugins and extensions", category: "Ecosystem", status: "beta" },
  { id: "dev-portal", name: "Dev Portal", description: "APIs, SDKs, and documentation", category: "Ecosystem", status: "live" },
]

const STATUS_LABEL: Record<ProductStatus, string> = {
  live: `${UI.Style.TEXT_SUCCESS}Live${UI.Style.RESET}`,
  beta: `${UI.Style.TEXT_WARNING}Beta${UI.Style.RESET}`,
  soon: `${UI.Style.TEXT_DIM}Coming Soon${UI.Style.RESET}`,
}

export const ProductsCommand = cmd({
  command: "products [category]",
  describe: "Browse the Allternit product catalog",
  builder: (yargs) =>
    yargs.positional("category", {
      type: "string",
      choices: CATEGORIES,
      describe: "Filter by category",
    }),

  handler: (args) => {
    const category = args.category as string | undefined
    const items = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS

    UI.println(UI.Style.TEXT_INFO_BOLD + "Allternit Products" + UI.Style.RESET)
    if (category) {
      UI.println(UI.Style.TEXT_DIM + `Category: ${category} · ${items.length} product(s)` + UI.Style.RESET)
    } else {
      UI.println(UI.Style.TEXT_DIM + `${items.length} products across ${CATEGORIES.length} categories` + UI.Style.RESET)
    }
    UI.empty()

    let currentCategory = ""
    for (const product of items) {
      if (!category && product.category !== currentCategory) {
        currentCategory = product.category
        UI.println(UI.Style.TEXT_NORMAL_BOLD + currentCategory + UI.Style.RESET)
      }
      const status = STATUS_LABEL[product.status]
      UI.println(`  ${status} ${UI.Style.TEXT_NORMAL_BOLD}${product.name}${UI.Style.RESET}`)
      UI.println(`    ${UI.Style.TEXT_DIM}${product.description}${UI.Style.RESET}`)
      if (!category) {
        UI.empty()
      }
    }

    if (!category) {
      UI.println(UI.Style.TEXT_DIM + `Run ${UI.Style.TEXT_HIGHLIGHT}gizzi products <category>${UI.Style.TEXT_DIM} to filter.${UI.Style.RESET}`)
    }
  },
})
