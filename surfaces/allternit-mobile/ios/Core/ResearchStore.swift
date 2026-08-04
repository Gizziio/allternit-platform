import SwiftUI

/// Research / Open Notebook state: notebooks, sources, and chat messages.
///
/// Data source: the headless Open Notebook backend on port 5055
/// (`Core/API/ResearchClient.swift`). On failure the store exposes `loadError`
/// so views render an error state instead of spinning forever.
@MainActor
final class ResearchStore: ObservableObject {
    static let shared = ResearchStore()

    @Published private(set) var notebooks: [ResearchNotebook] = []
    @Published private(set) var sources: [ResearchSource] = []
    @Published private(set) var messages: [ResearchChatMessage] = []
    @Published var activeNotebookId: String? = nil
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var apiAvailable: Bool? = nil

    private let client: ResearchClient

    init(client: ResearchClient = .shared) {
        self.client = client
    }

    var activeNotebook: ResearchNotebook? {
        guard let activeNotebookId else { return nil }
        return notebooks.first { $0.id == activeNotebookId }
    }

    // MARK: - Boot / fetch

    func checkHealthAndLoad() {
        Task {
            do {
                apiAvailable = try await client.health()
            } catch {
                apiAvailable = false
                loadError = "Research backend unavailable: \(error.localizedDescription)"
                return
            }
            await loadNotebooks()
        }
    }

    func loadNotebooks() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            notebooks = try await client.listNotebooks()
            if activeNotebookId == nil, let first = notebooks.first {
                activeNotebookId = first.id
            }
            await refreshActiveNotebook()
        } catch {
            loadError = error.localizedDescription
        }
    }

    func selectNotebook(id: String) {
        activeNotebookId = id
        Task {
            await refreshActiveNotebook()
        }
    }

    func refreshActiveNotebook() async {
        guard let id = activeNotebookId else {
            sources = []
            messages = []
            return
        }
        async let sourcesTask: () = loadSources(notebookId: id)
        async let messagesTask: () = loadMessages(notebookId: id)
        _ = await (sourcesTask, messagesTask)
    }

    private func loadSources(notebookId: String) async {
        do {
            sources = try await client.listSources(notebookId: notebookId)
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func loadMessages(notebookId: String) async {
        do {
            messages = try await client.listMessages(notebookId: notebookId)
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Mutations

    func createNotebook(title: String, description: String? = nil) async throws {
        let notebook = try await client.createNotebook(title: title, description: description)
        notebooks.append(notebook)
        activeNotebookId = notebook.id
        sources = []
        messages = []
    }

    func deleteNotebook(id: String) async throws {
        try await client.deleteNotebook(id: id)
        notebooks.removeAll { $0.id == id }
        if activeNotebookId == id {
            activeNotebookId = notebooks.first?.id
            await refreshActiveNotebook()
        }
    }

    func addTextSource(title: String, content: String) async throws {
        guard let notebookId = activeNotebookId else { return }
        let source = try await client.addTextSource(notebookId: notebookId, title: title, content: content)
        sources.append(source)
    }

    func removeSource(id: String) async throws {
        guard let notebookId = activeNotebookId else { return }
        try await client.removeSource(notebookId: notebookId, sourceId: id)
        sources.removeAll { $0.id == id }
    }

    func sendMessage(_ text: String) async throws {
        guard let notebookId = activeNotebookId else { return }
        let userMessage = ResearchChatMessage(
            id: "user-\(Date().timeIntervalSince1970)",
            role: "user",
            content: text,
            citations: nil,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            createdAt: nil
        )
        messages.append(userMessage)

        let reply = try await client.sendMessage(notebookId: notebookId, message: text)
        let assistantMessage = ResearchChatMessage(
            id: "assistant-\(Date().timeIntervalSince1970)",
            role: "assistant",
            content: reply,
            citations: nil,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            createdAt: nil
        )
        messages.append(assistantMessage)
    }
}
