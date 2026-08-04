import Foundation

// ------------------------------------------------------------------------------
// Open Notebook research models — mirror the web's research hooks
// (surfaces/ai.allternit.com/src/views/research/hooks/useNotebookApi.ts).
//
// The Open Notebook backend runs on its own host (default 127.0.0.1:5055) and
// emits snake_case keys; Swift properties stay camelCase via CodingKeys.
// ------------------------------------------------------------------------------

struct ResearchNotebook: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let sourceCount: Int
    let tokenCount: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description
        case sourceCount = "source_count"
        case tokenCount = "token_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct ResearchSource: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let notebookId: String
    let type: String
    let title: String
    let url: String?
    let content: String?
    let tokenCount: Int
    let status: String

    enum CodingKeys: String, CodingKey {
        case id, type, title, url, content, status
        case notebookId = "notebook_id"
        case tokenCount = "token_count"
    }
}

struct ResearchCitation: Decodable, Sendable, Hashable {
    let index: Int
    let sourceId: String
    let excerpt: String
    let pageNumber: Int?

    enum CodingKeys: String, CodingKey {
        case index, excerpt
        case sourceId = "source_id"
        case pageNumber = "page_number"
    }
}

struct ResearchChatMessage: Decodable, Sendable, Identifiable, Hashable {
    let id: String
    let role: String
    let content: String
    let citations: [ResearchCitation]?
    let timestamp: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, role, content, citations, timestamp
        case createdAt = "created_at"
    }
}
