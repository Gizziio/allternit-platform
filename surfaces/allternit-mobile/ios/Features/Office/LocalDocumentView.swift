import SwiftUI
import PDFKit
import QuickLook
import UniformTypeIdentifiers

/// Opens a locally-shared office file inside the Allternit app.
///
/// PDFs render natively with PDFKit; Markdown renders as plain text;
/// Word/Excel fall back to QuickLook so the user can read them without
/// leaving the workspace.
struct LocalDocumentView: View {
    let fileURL: URL
    @State private var isSharePresented = false
    @State private var textContent: String?
    @State private var loadError: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let error = loadError {
                    ContentUnavailableView(
                        "Couldn't open document",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else {
                    documentBody
                }
            }
            .navigationTitle(fileURL.lastPathComponent)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { isSharePresented = true }) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $isSharePresented) {
                ShareSheet(items: [fileURL])
            }
            .background(Color("BgPrimary").ignoresSafeArea())
        }
    }

    @ViewBuilder
    private var documentBody: some View {
        switch fileType {
        case .pdf:
            if let pdf = PDFDocument(url: fileURL) {
                LocalPDFKitView(document: pdf)
                    .padding(8)
            } else {
                ContentUnavailableView(
                    "PDF preview unavailable",
                    systemImage: "doc.text",
                    description: Text("The file could not be rendered.")
                )
            }
        case .markdown, .plainText:
            ScrollView {
                Text(textContent ?? "")
                    .font(.body)
                    .foregroundColor(Color("TextPrimary"))
                    .textSelection(.enabled)
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .task { loadText() }
        case .word, .excel, .unknown:
            QuickLookPreview(fileURL: fileURL)
        }
    }

    private var fileType: LocalFileType {
        if let uti = UTType(filenameExtension: fileURL.pathExtension) {
            if uti.conforms(to: .pdf) { return .pdf }
            if uti.conforms(to: .plainText) { return .plainText }
            if uti.conforms(to: .spreadsheet) { return .excel }
            if uti.conforms(to: .commaSeparatedText) { return .excel }
        }
        switch fileURL.pathExtension.lowercased() {
        case "pdf": return .pdf
        case "md", "markdown": return .markdown
        case "txt", "text": return .plainText
        case "doc", "docx": return .word
        case "xls", "xlsx", "csv": return .excel
        default: return .unknown
        }
    }

    private func loadText() {
        do {
            textContent = try String(contentsOf: fileURL, encoding: .utf8)
        } catch {
            loadError = error.localizedDescription
        }
    }
}

private enum LocalFileType {
    case pdf, markdown, plainText, word, excel, unknown
}

private struct LocalPDFKitView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.document = document
        pdfView.autoScales = true
        pdfView.backgroundColor = .clear
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}

private struct QuickLookPreview: UIViewControllerRepresentable {
    let fileURL: URL

    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(fileURL: fileURL)
    }

    class Coordinator: NSObject, QLPreviewControllerDataSource {
        let fileURL: URL
        init(fileURL: URL) { self.fileURL = fileURL }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            fileURL as NSURL
        }
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
