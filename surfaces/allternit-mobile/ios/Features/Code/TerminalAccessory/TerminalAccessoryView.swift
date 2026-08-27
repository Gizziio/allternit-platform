import PhotosUI
import SwiftUI

/// Content of the terminal's `inputAccessoryView`: a control-key row (mic,
/// image, Esc/Tab/arrows/Ctrl shortcuts) and a draft row so voice/image
/// input can be reviewed before it hits stdin. Stateless — entirely driven
/// by `controller`. Dark styling matches the terminal's own black backdrop
/// rather than the app's light chrome, since it's docked directly above it.
struct TerminalAccessoryView: View {
    @ObservedObject var controller: TerminalAccessoryController
    @State private var pickedPhoto: PhotosPickerItem?

    var body: some View {
        VStack(spacing: 0) {
            Divider().background(Color.white.opacity(0.15))
            keyRow
            Divider().background(Color.white.opacity(0.1))
            // Always present (not conditional on having a draft) so the
            // accessory's total height stays fixed — `inputAccessoryView`
            // doesn't re-layout cleanly when its content's intrinsic size
            // changes underneath it.
            draftRow
        }
        .background(Color.black.opacity(0.95))
        .onChange(of: controller.dictation.transcript) { _, transcript in
            controller.dictationTranscriptChanged(transcript)
        }
        .onChange(of: controller.dictation.isRecording) { _, isRecording in
            controller.dictationRecordingChanged(isRecording)
        }
        .onChange(of: pickedPhoto) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self) else { return }
                let contentType = item.supportedContentTypes.first ?? .jpeg
                let mediaType = contentType.preferredMIMEType ?? "image/jpeg"
                let ext = contentType.preferredFilenameExtension ?? "jpg"
                await controller.uploadImage(data: data, filename: "photo.\(ext)", mediaType: mediaType)
                pickedPhoto = nil
            }
        }
    }

    private var keyRow: some View {
        // Snapshotted locally: PhotosPicker's label closure isn't
        // MainActor-isolated in this SDK, so it can't read
        // `controller`'s actor-isolated properties directly — only
        // Sendable locals captured from this (MainActor) `body` scope.
        let isUploadingImage = controller.isUploadingImage
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button {
                    controller.toggleDictation()
                } label: {
                    Image(systemName: controller.dictation.isRecording ? "mic.fill" : "mic")
                        .foregroundColor(controller.dictation.isRecording ? Theme.accentCode : .white)
                }
                .frame(width: 36, height: 36)

                PhotosPicker(selection: $pickedPhoto, matching: .images) {
                    if isUploadingImage {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "photo")
                            .foregroundColor(.white)
                    }
                }
                .frame(width: 36, height: 36)
                .disabled(isUploadingImage)

                Divider().frame(height: 20).background(Color.white.opacity(0.2))

                ForEach(TerminalControlKey.allCases, id: \.self) { key in
                    Button {
                        controller.insertControlSequence(key)
                    } label: {
                        Text(key.label)
                            .font(.system(.footnote, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .frame(minWidth: 36, minHeight: 36)
                }
            }
            .padding(.horizontal, 8)
        }
        .frame(height: 44)
    }

    private var draftRow: some View {
        HStack(spacing: 8) {
            TextField(placeholderText, text: $controller.draftText)
                .font(.system(.subheadline, design: .monospaced))
                .foregroundColor(.white)
                .tint(.white)
                .lineLimit(1)
            Button {
                controller.sendDraft()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(controller.draftText.isEmpty ? .white.opacity(0.3) : Theme.accentCode)
            }
            .disabled(controller.draftText.isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(height: 44)
    }

    private var placeholderText: String {
        if let uploadError = controller.uploadError { return uploadError }
        if controller.dictation.isRecording { return "Listening…" }
        if controller.isUploadingImage { return "Uploading…" }
        return "Dictate or type, then send"
    }
}
