import Foundation

/// One library entry: the artifact record plus where/when it was seen.
struct SavedArtifact: Identifiable, Hashable, Sendable, Codable {
    let record: ArtifactRecord
    /// Session the artifact frame arrived in (nil if unknown).
    let sessionId: String?
    let savedAt: Date

    var id: String { record.id }
}

/// The Artifacts Library tab's data source.
///
/// The backend has no artifact LIST endpoint (`GET /v1/artifacts/:id` is a
/// 404 stub and the `artifact.created` stream frame is the content carrier —
/// see ArtifactContentLoader), but it DOES persist artifacts as canvases
/// (canvas_routes.rs; the web writes one canvas per artifact via
/// persistArtifactToCanvas). So the library has two sources, merged and
/// persisted to Application Support:
///
/// 1. Live stream frames, recorded as they arrive (instant, offline-safe) —
///    and mirrored back to the backend as canvases so the web sees them.
/// 2. `refreshFromBackend()`: lists the authenticated user's canvases to pick
///    up artifacts created on other surfaces (or before this install).
@MainActor
final class ArtifactLibraryStore: ObservableObject {
    static let shared = ArtifactLibraryStore()

    @Published private(set) var artifacts: [SavedArtifact] = []
    @Published private(set) var isRefreshing = false

    /// artifactId → canvasId for canvases this device created; re-seen
    /// artifacts PATCH their canvas instead of creating a duplicate
    /// (the web keeps the same map in artifactCanvasIds).
    private var canvasIds: [String: String] = [:]

    private let fileURL: URL
    private let canvasClient = CanvasClient()
    private struct Persisted: Codable {
        var artifacts: [SavedArtifact]
        var canvasIds: [String: String]
    }

    init(filename: String = "artifact-library.json") {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        fileURL = support.appendingPathComponent(filename)
        let persisted = Self.load(from: fileURL)
        artifacts = persisted.artifacts
        canvasIds = persisted.canvasIds
    }

    /// Records an artifact seen in a stream. Re-seeing an id (retries,
    /// re-opened sessions replaying frames) replaces the stale entry and
    /// bumps it to the top. The canvas mirror is fire-and-forget: the
    /// library is source-of-truth locally either way.
    func record(_ record: ArtifactRecord, sessionId: String?) {
        artifacts.removeAll { $0.record.id == record.id }
        artifacts.insert(SavedArtifact(record: record, sessionId: sessionId, savedAt: Date()), at: 0)
        save()

        guard let sessionId else { return }
        Task { await mirrorToBackend(record, sessionId: sessionId) }
    }

    func remove(id: String) {
        artifacts.removeAll { $0.record.id == id }
        save()
    }

    /// Lists the user's canvases and merges web-created artifacts and newer
    /// backend redeploys. Versioned entries only advance monotonically; a
    /// first versioned backend copy may replace an unversioned local entry.
    func refreshFromBackend() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        // A failed list leaves the local library intact (additive best-effort).
        guard let canvases = try? await canvasClient.listCanvases() else { return }
        let fetched = Self.savedArtifacts(from: canvases)

        var mergedById: [String: SavedArtifact] = [:]
        for artifact in artifacts where mergedById[artifact.id] == nil {
            mergedById[artifact.id] = artifact
        }
        var changed = false
        for candidate in fetched {
            guard let existing = mergedById[candidate.id] else {
                mergedById[candidate.id] = candidate
                changed = true
                continue
            }
            guard let fetchedVersion = candidate.record.version else { continue }
            if existing.record.version.map({ fetchedVersion > $0 }) ?? true {
                mergedById[candidate.id] = candidate
                changed = true
            }
        }
        guard changed else { return }
        artifacts = mergedById.values.sorted { $0.savedAt > $1.savedAt }
        save()
    }

    // MARK: - Canvas mapping

    nonisolated private static func savedArtifacts(from canvases: [CanvasRecord]) -> [SavedArtifact] {
        canvases.flatMap { canvas in
            canvas.components.compactMap { component -> SavedArtifact? in
                guard component.type == "artifact" else { return nil }
                let artifactId = canvas.artifactKey ?? component.artifactId ?? canvas.id
                let record = ArtifactRecord(
                    id: artifactId,
                    title: component.title ?? canvas.title ?? "Untitled artifact",
                    fileType: component.kind ?? "text",
                    artifactId: artifactId,
                    artifactType: component.kind,
                    url: component.url,
                    inlinePreview: component.content,
                    version: canvas.version
                )
                return SavedArtifact(
                    record: record,
                    sessionId: canvas.sessionId,
                    savedAt: Self.parseTimestamp(canvas.updatedAt) ?? Date()
                )
            }
        }
    }

    private func mirrorToBackend(_ record: ArtifactRecord, sessionId: String) async {
        do {
            if let canvasId = canvasIds[record.id] {
                try await canvasClient.updateArtifactCanvas(canvasId: canvasId, artifact: record)
            } else {
                let canvasId = try await canvasClient.createArtifactCanvas(sessionId: sessionId, artifact: record)
                canvasIds[record.id] = canvasId
                save()
            }
        } catch {
            // Mirror is best-effort; a later re-see retries naturally.
        }
    }

    /// Backend timestamps are RFC-3339 (chrono `to_rfc3339`), with or
    /// without fractional seconds.
    nonisolated private static func parseTimestamp(_ value: String) -> Date? {
        if let date = try? Date(value, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) {
            return date
        }
        return try? Date(value, strategy: Date.ISO8601FormatStyle())
    }

    // MARK: - Persistence

    private static func load(from url: URL) -> Persisted {
        guard let data = try? Data(contentsOf: url) else {
            return Persisted(artifacts: [], canvasIds: [:])
        }
        if let persisted = try? JSONDecoder().decode(Persisted.self, from: data) {
            return persisted
        }
        // Pre-canvas library files were a bare [SavedArtifact] array.
        let legacy = (try? JSONDecoder().decode([SavedArtifact].self, from: data)) ?? []
        return Persisted(artifacts: legacy, canvasIds: [:])
    }

    private func save() {
        let persisted = Persisted(artifacts: artifacts, canvasIds: canvasIds)
        guard let data = try? JSONEncoder().encode(persisted) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
