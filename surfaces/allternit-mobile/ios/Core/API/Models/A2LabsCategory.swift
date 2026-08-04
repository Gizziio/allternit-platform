import Foundation

// ------------------------------------------------------------------------------
// A://Labs course categories — mirrors `A2LABS_CATEGORIES` in
// surfaces/ai.allternit.com/src/views/catalog/main/CatalogView.constants.ts.
// ------------------------------------------------------------------------------

struct A2LabsCategory: Identifiable, Sendable {
    let id: String
    let tier: String
    let label: String
    let description: String
    let searchQueries: [String]
}

extension A2LabsCategory {
    static let all: [A2LabsCategory] = [
        A2LabsCategory(
            id: "core-reasoning", tier: "CORE",
            label: "AI Reasoning & Prompt Engineering",
            description: "Structured reasoning, prompt engineering, decomposition",
            searchQueries: ["prompt engineering", "AI reasoning", "chain of thought", "LLM prompting"]
        ),
        A2LabsCategory(
            id: "core-multimodal", tier: "CORE",
            label: "Multimodal AI Workflows",
            description: "Processing text/images/PDFs, document intelligence",
            searchQueries: ["multimodal AI", "computer vision AI", "document processing AI", "OCR AI"]
        ),
        A2LabsCategory(
            id: "core-evaluation", tier: "CORE",
            label: "AI Evaluation & Trust",
            description: "Evaluation criteria, trust boundaries, quality assessment",
            searchQueries: ["AI evaluation", "LLM evaluation", "AI safety", "AI trust"]
        ),
        A2LabsCategory(
            id: "ops-workflows", tier: "OPS",
            label: "AI Workflow Design",
            description: "Process mapping, automation, AI-augmented workflows",
            searchQueries: ["AI workflow automation", "AI automation", "AI productivity"]
        ),
        A2LabsCategory(
            id: "ops-research", tier: "OPS",
            label: "Research Operations",
            description: "AI-assisted research workflows",
            searchQueries: ["AI research", "research automation AI", "web scraping AI"]
        ),
        A2LabsCategory(
            id: "ops-content", tier: "OPS",
            label: "Content Operations",
            description: "Content generation, content pipeline automation",
            searchQueries: ["AI content generation", "AI writing", "content automation"]
        ),
        A2LabsCategory(
            id: "ops-knowledge", tier: "OPS",
            label: "Knowledge Management",
            description: "Knowledge base design, information organization",
            searchQueries: ["knowledge management AI", "enterprise search AI", "document management AI"]
        ),
        A2LabsCategory(
            id: "agents-rag", tier: "AGENTS",
            label: "RAG & Document Intelligence",
            description: "RAG systems, vector databases, semantic search",
            searchQueries: ["RAG AI", "retrieval augmented generation", "vector database", "LangChain RAG"]
        ),
        A2LabsCategory(
            id: "agents-orchestration", tier: "AGENTS",
            label: "Multi-Agent Orchestration",
            description: "Agent orchestration, collaboration, LangGraph, CrewAI",
            searchQueries: ["multi-agent AI", "LangGraph", "CrewAI", "AI agent collaboration"]
        ),
        A2LabsCategory(
            id: "agents-code", tier: "AGENTS",
            label: "AI Copilot & Code Generation",
            description: "Repo-aware coding assistants, code suggestion",
            searchQueries: ["AI coding assistant", "code generation AI", "automated code review"]
        ),
        A2LabsCategory(
            id: "agents-web", tier: "AGENTS",
            label: "Web Research Agent",
            description: "Web search automation, content extraction",
            searchQueries: ["web scraping Python", "web automation AI", "AI web research"]
        ),
        A2LabsCategory(
            id: "agents-kb", tier: "AGENTS",
            label: "Knowledge Base Assistant",
            description: "Multi-source ingestion, unified search, document Q&A",
            searchQueries: ["chatbot knowledge base", "RAG chatbot", "document Q&A AI"]
        ),
    ]
}
