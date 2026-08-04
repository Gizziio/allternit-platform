import Foundation

/// Supported office/document kinds mirrored from the web's `office-io` packs.
enum DocumentKind: String, Codable, Sendable, CaseIterable {
    case docx, xlsx, pptx, pdf, txt, md, unknown

    var label: String {
        switch self {
        case .docx: return "Word"
        case .xlsx: return "Excel"
        case .pptx: return "PowerPoint"
        case .pdf: return "PDF"
        case .txt: return "Text"
        case .md: return "Markdown"
        case .unknown: return "Document"
        }
    }

    var icon: String {
        switch self {
        case .docx: return "doc.text"
        case .xlsx: return "tablecells"
        case .pptx: return "play.rectangle"
        case .pdf: return "doc.richtext"
        case .txt, .md: return "doc.plaintext"
        case .unknown: return "doc"
        }
    }
}

/// Metadata for a document imported into the iOS app's local Documents store.
struct DocumentFile: Identifiable, Codable, Equatable, Sendable {
    let id: UUID
    var title: String
    let fileName: String
    let createdAt: Date
    var updatedAt: Date

    var kind: DocumentKind {
        DocumentKind(rawValue: (fileName as NSString).pathExtension.lowercased()) ?? .unknown
    }

    var displayTitle: String {
        title.isEmpty ? fileName : title
    }
}
