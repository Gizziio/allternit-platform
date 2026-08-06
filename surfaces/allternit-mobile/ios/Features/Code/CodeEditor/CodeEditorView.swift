import SwiftUI
import Runestone

/// SwiftUI wrapper around Runestone's `TextView`, replacing the plain
/// `TextEditor` in `WorkspaceFileEditorView` with a gutter + Tree-sitter
/// syntax highlighting (language resolved via `CodeLanguage.language(forPath:)`).
///
/// `updateUIView` only re-applies `TextViewState` when the binding's value
/// diverges from what's on screen — otherwise every keystroke would tear
/// down and rebuild the Tree-sitter parse tree (and drop the cursor
/// position), since the delegate below writes typed text straight back into
/// the same binding.
struct CodeEditorView: UIViewRepresentable {
    @Binding var text: String
    let language: TreeSitterLanguage?
    var isEditable: Bool = true

    func makeUIView(context: Context) -> TextView {
        let textView = TextView()
        textView.backgroundColor = .clear
        textView.showLineNumbers = true
        textView.isLineWrappingEnabled = true
        textView.lineHeightMultiplier = 1.15
        textView.autocorrectionType = .no
        textView.autocapitalizationType = .none
        textView.smartQuotesType = .no
        textView.smartDashesType = .no
        textView.spellCheckingType = .no
        textView.isEditable = isEditable
        textView.editorDelegate = context.coordinator
        textView.setState(makeState())
        return textView
    }

    func updateUIView(_ textView: TextView, context: Context) {
        textView.isEditable = isEditable
        guard textView.text != text else { return }
        textView.setState(makeState())
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    private func makeState() -> TextViewState {
        if let language {
            return TextViewState(text: text, language: language)
        }
        return TextViewState(text: text)
    }

    // Runestone (tools-version 5.5) doesn't declare `TextViewDelegate`
    // requirements as @MainActor, so witnessing them is inferred
    // `nonisolated` by default — but `TextView` (a UIView subclass) is
    // @MainActor-isolated by the SDK, so a nonisolated witness can't
    // synchronously read `textView.text` at all, and hopping through a
    // `Task { @MainActor in }` to do so trips "sending non-Sendable value"
    // on the `TextView` parameter itself. Explicitly isolating the witness
    // to `@MainActor` (accurate: Runestone only ever calls `editorDelegate`
    // from the main thread) fixes the body; `@preconcurrency` on the
    // conformance downgrades the resulting requirement/witness isolation
    // mismatch from an error to a warning, since the protocol comes from a
    // pre-Swift-6 module.
    final class Coordinator: NSObject, @preconcurrency TextViewDelegate {
        private let text: Binding<String>

        init(text: Binding<String>) {
            self.text = text
        }

        @MainActor
        func textViewDidChange(_ textView: TextView) {
            text.wrappedValue = textView.text
        }
    }
}
