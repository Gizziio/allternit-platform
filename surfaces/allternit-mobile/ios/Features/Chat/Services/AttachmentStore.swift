import SwiftUI

/// One attachment staged in the composer (Claude iOS parity: the "+" sheet's
/// picks appear as a thumbnail strip above the text field until sent).
/// `data` is the full payload uploaded to `POST /api/v1/uploads` on send;
/// `thumbnail` is what the strip renders (nil for files, which get an icon).
struct StagedAttachment: Identifiable {
    enum UploadState: Equatable {
        case pending
        case uploading
        case uploaded(url: String)
        case failed(String)
    }

    let id: UUID
    let thumbnail: UIImage?
    let data: Data
    let filename: String
    let mediaType: String
    var uploadState: UploadState = .pending

    init(id: UUID = UUID(), thumbnail: UIImage?, data: Data, filename: String, mediaType: String) {
        self.id = id
        self.thumbnail = thumbnail
        self.data = data
        self.filename = filename
        self.mediaType = mediaType
    }

    /// SF Symbol for non-image attachments in the strip.
    var fileIcon: String {
        if mediaType.hasPrefix("image/") { return "photo" }
        if mediaType == "application/pdf" { return "doc.text" }
        return "doc"
    }
}

/// Staged composer attachments. Owned by ComposerView; the "+" sheet's
/// pickers (PhotosPicker / camera / document picker) add here, the strip
/// above the text field renders them, and send uploads + clears them.
@MainActor
final class AttachmentStore: ObservableObject {
    @Published private(set) var attachments: [StagedAttachment] = []

    func add(_ attachment: StagedAttachment) {
        attachments.append(attachment)
    }

    func remove(id: UUID) {
        attachments.removeAll { $0.id == id }
    }

    func clear() {
        attachments.removeAll()
    }

    func update(id: UUID, _ mutate: (inout StagedAttachment) -> Void) {
        guard let index = attachments.firstIndex(where: { $0.id == id }) else { return }
        mutate(&attachments[index])
    }
}
