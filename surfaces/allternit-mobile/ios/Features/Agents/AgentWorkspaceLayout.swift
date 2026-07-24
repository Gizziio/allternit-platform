import Foundation

/// The platform's agent-workspace layout (mirrors the web's
/// `agent-workspace.service.ts` document tree): every agent workspace is
/// organized into category directories, and each category has well-known
/// documents. The detail view uses this to group existing files AND to
/// offer the not-yet-created platform docs as one-tap creates — context
/// files are guided into these categories rather than free-form clutter.
///
/// Runtime truth today: the chat bridge reads ROOT `SOUL.md`/`STYLE.md`
/// only (v1_routes.rs agent_chat_bridge); the categorized tree is the
/// platform's document model and what the daemon consumes as it learns
/// to. The UI labels the Core group accordingly.
struct AgentWorkspaceCategory: Identifiable, Hashable {
    /// Directory prefix inside the workspace; "" is the workspace root.
    let directory: String
    let label: String
    /// One-line "what belongs here" shown under the section header.
    let guidance: String
    /// Well-known platform documents (filenames only, no directory).
    let knownDocs: [String]

    var id: String { directory.isEmpty ? "__root__" : directory }

    /// Full workspace path for a doc in this category.
    func path(for doc: String) -> String {
        directory.isEmpty ? doc : "\(directory)/\(doc)"
    }
}

enum AgentWorkspaceLayout {
    static let categories: [AgentWorkspaceCategory] = [
        AgentWorkspaceCategory(
            directory: "",
            label: "Core",
            guidance: "Read at chat time today (SOUL.md · STYLE.md)",
            knownDocs: ["SOUL.md", "TOOLS.md", "HEARTBEAT.md"]
        ),
        AgentWorkspaceCategory(
            directory: "identity",
            label: "Identity",
            guidance: "Who the agent is and how it presents itself",
            knownDocs: ["IDENTITY.md", "SOUL.md"]
        ),
        AgentWorkspaceCategory(
            directory: "cognitive",
            label: "Cognitive",
            guidance: "How the agent reasons and decides",
            knownDocs: ["COGNITIVE.md"]
        ),
        AgentWorkspaceCategory(
            directory: "brain",
            label: "Brain",
            guidance: "Working knowledge always at hand",
            knownDocs: ["BRAIN.md"]
        ),
        AgentWorkspaceCategory(
            directory: "memory",
            label: "Memory",
            guidance: "Durable facts kept across sessions",
            knownDocs: ["MEMORY.md"]
        ),
        AgentWorkspaceCategory(
            directory: "governance",
            label: "Governance",
            guidance: "Operating rules and guardrails",
            knownDocs: ["PLAYBOOK.md"]
        ),
        AgentWorkspaceCategory(
            directory: "business",
            label: "Business",
            guidance: "Offers, customers, and goals",
            knownDocs: ["BUSINESS.md"]
        ),
    ]

    /// Starter content for a newly created document: a title plus one
    /// guiding sentence so the file's PURPOSE is never ambiguous. STYLE.md
    /// is absent — it is platform-managed by response-style sync, never
    /// hand-created.
    static func starterContent(for path: String) -> String {
        let doc = path.split(separator: "/").last.map(String.init) ?? path
        switch doc {
        case "AGENTS.md":
            return "# Agents\n\nWorkspace instructions for this agent — layered into every session alongside the system prompt.\n"
        case "SOUL.md":
            return "# Soul\n\nWho this agent is — temperament, voice, and values in a few honest paragraphs.\n"
        case "IDENTITY.md":
            return "# Identity\n\nName, role, and how this agent introduces itself.\n"
        case "COGNITIVE.md":
            return "# Cognitive\n\nHow this agent thinks: reasoning style, defaults, decision rules.\n"
        case "BRAIN.md":
            return "# Brain\n\nWorking knowledge this agent should always have loaded.\n"
        case "MEMORY.md":
            return "# Memory\n\nDurable facts worth keeping across sessions.\n"
        case "PLAYBOOK.md":
            return "# Playbook\n\nOperating rules: what to do, in what order, and what never to do.\n"
        case "BUSINESS.md":
            return "# Business\n\nCommercial context: offers, pricing, customers, goals.\n"
        case "TOOLS.md":
            return "# Tools\n\nTools this agent may use, and when.\n"
        case "HEARTBEAT.md":
            return "# Heartbeat\n\nRecurring checks this agent runs on a schedule.\n"
        default:
            let base = doc.replacingOccurrences(of: ".md", with: "")
                .replacingOccurrences(of: "-", with: " ")
                .replacingOccurrences(of: "_", with: " ")
                .capitalized
            return "# \(base)\n\n"
        }
    }
}
