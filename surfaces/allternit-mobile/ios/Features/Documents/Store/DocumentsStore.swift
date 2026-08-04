import Foundation
import UniformTypeIdentifiers

/// Local document library for iOS — phase 1: import, list, preview, share, delete.
///
/// Mirrors the web's `views/documents/office-io` concept in a mobile-native way:
/// files live in the app's Documents/Documents sandbox directory, metadata is
/// persisted to UserDefaults, and preview uses `QLPreviewController`.
@MainActor
final class DocumentsStore: ObservableObject {
    static let shared = DocumentsStore()

    private static let metadataKey = "allternit-documents-metadata"

    @Published private(set) var files: [DocumentFile] = []
    @Published private(set) var isImporting = false
    @Published var lastError: String? = nil

    private let fileManager = FileManager.default
    private let docsDir: URL

    init() {
        let base = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        docsDir = base.appendingPathComponent("Documents", isDirectory: true)
        try? fileManager.createDirectory(at: docsDir, withIntermediateDirectories: true)
        load()
    }

    // MARK: - Persistence

    func load() {
        guard let data = UserDefaults.standard.data(forKey: Self.metadataKey),
              let decoded = try? JSONDecoder().decode([DocumentFile].self, from: data) else {
            files = []
            return
        }
        files = decoded.sorted { $0.updatedAt > $1.updatedAt }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(files) {
            UserDefaults.standard.set(data, forKey: Self.metadataKey)
        }
    }

    // MARK: - Import

    /// Import a security-scoped URL provided by a `UIDocumentPickerViewController`.
    func importFile(from sourceURL: URL) async {
        isImporting = true
        lastError = nil
        defer { isImporting = false }

        let accessed = sourceURL.startAccessingSecurityScopedResource()
        defer { if accessed { sourceURL.stopAccessingSecurityScopedResource() } }

        do {
            guard sourceURL.isFileURL else {
                throw DocumentsError.importFailed("Remote URLs are not supported in phase 1.")
            }

            let originalName = sourceURL.lastPathComponent
            let uniqueName = makeUniqueFileName(originalName)
            let destination = docsDir.appendingPathComponent(uniqueName)

            // Copy rather than move — picker URLs are often outside the sandbox.
            if fileManager.fileExists(atPath: destination.path) {
                try fileManager.removeItem(at: destination)
            }
            try fileManager.copyItem(at: sourceURL, to: destination)

            let now = Date()
            let file = DocumentFile(
                id: UUID(),
                title: (originalName as NSString).deletingPathExtension,
                fileName: uniqueName,
                createdAt: now,
                updatedAt: now
            )

            files.append(file)
            files.sort { $0.updatedAt > $1.updatedAt }
            save()
        } catch {
            lastError = "Couldn't import \(sourceURL.lastPathComponent): \(error.localizedDescription)"
        }
    }

    func importFiles(from urls: [URL]) async {
        for url in urls {
            await importFile(from: url)
        }
    }

    // MARK: - Mutations

    func updateTitle(for file: DocumentFile, to newTitle: String) {
        guard let index = files.firstIndex(where: { $0.id == file.id }) else { return }
        files[index].title = newTitle
        files[index].updatedAt = Date()
        files.sort { $0.updatedAt > $1.updatedAt }
        save()
    }

    func delete(_ file: DocumentFile) {
        files.removeAll { $0.id == file.id }
        let url = docsDir.appendingPathComponent(file.fileName)
        try? fileManager.removeItem(at: url)
        save()
    }

    // MARK: - Access

    func url(for file: DocumentFile) -> URL {
        docsDir.appendingPathComponent(file.fileName)
    }

    // MARK: - Helpers

    private func makeUniqueFileName(_ original: String) -> String {
        let base = (original as NSString).deletingPathExtension
        let ext = (original as NSString).pathExtension
        var candidate = original
        var counter = 1
        while fileManager.fileExists(atPath: docsDir.appendingPathComponent(candidate).path) {
            candidate = "\(base) (\(counter))" + (ext.isEmpty ? "" : ".\(ext)")
            counter += 1
        }
        return candidate
    }
}

enum DocumentsError: Error, LocalizedError {
    case importFailed(String)

    var errorDescription: String? {
        switch self {
        case .importFailed(let reason): return reason
        }
    }
}
