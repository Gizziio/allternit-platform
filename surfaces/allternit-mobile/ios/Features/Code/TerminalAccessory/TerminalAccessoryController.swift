import Foundation
import UIKit

/// Owns the terminal accessory row's state: voice-to-terminal (via a reused
/// `DictationController`), image-to-terminal (upload + insert the resulting
/// URL as text), and control-key taps. All three funnel into
/// `PtySession.send(_:)`, the same verbatim-stdin sink the terminal's own
/// keystrokes use.
///
/// Neither voice nor image ever auto-sends: a half-formed shell command
/// landing on stdin because of a stray Enter is worse than a half-formed
/// sentence in a chat draft, so both just populate `draftText` (or insert an
/// uploaded URL) for the user to review and send explicitly.
@MainActor
final class TerminalAccessoryController: ObservableObject {
    let dictation = DictationController()

    @Published var draftText: String = ""
    @Published var isUploadingImage = false
    @Published var uploadError: String? = nil

    private let session: PtySession
    /// The draft text as it stood before the current dictation session
    /// started — mirrors the Chat composer's `dictationBase` pattern so live
    /// partials replace only the dictated tail.
    private var dictationBase: String = ""
    private var isDictating = false

    init(session: PtySession) {
        self.session = session
    }

    // MARK: - Voice

    func toggleDictation() {
        if dictation.isRecording {
            dictation.stop()
            return
        }
        dictationBase = draftText.isEmpty || draftText.hasSuffix(" ") ? draftText : draftText + " "
        isDictating = true
        Task { await dictation.start() }
    }

    /// Called from the view's `.onChange(of: dictation.transcript)`.
    func dictationTranscriptChanged(_ transcript: String) {
        guard isDictating else { return }
        draftText = dictationBase + transcript
    }

    /// Called from the view's `.onChange(of: dictation.isRecording)`.
    func dictationRecordingChanged(_ isRecording: Bool) {
        guard !isRecording, isDictating else { return }
        draftText = dictationBase + dictation.transcript
        isDictating = false
    }

    // MARK: - Image

    /// Uploads the picked image via the same `/api/v1/uploads` endpoint the
    /// Chat composer uses, then inserts the resulting URL as plain text (no
    /// trailing newline — the user reviews before sending, same as voice).
    /// A pty has no inline-image concept, so a short fetchable URL is the
    /// terminal-shaped equivalent of an attachment.
    func uploadImage(data: Data, filename: String, mediaType: String) async {
        isUploadingImage = true
        uploadError = nil
        do {
            let response = try await AgentChatClient().upload(
                name: filename,
                mediaType: mediaType,
                dataBase64: data.base64EncodedString()
            )
            insertIntoDraft(response.url)
        } catch {
            uploadError = error.localizedDescription
        }
        isUploadingImage = false
    }

    private func insertIntoDraft(_ text: String) {
        if !draftText.isEmpty, !draftText.hasSuffix(" ") {
            draftText += " "
        }
        draftText += text
    }

    // MARK: - Send / control keys

    func sendDraft() {
        guard !draftText.isEmpty else { return }
        session.send(draftText + "\n")
        draftText = ""
    }

    func insertControlSequence(_ key: TerminalControlKey) {
        session.send(String(decoding: key.bytes, as: UTF8.self))
    }
}
