import SwiftUI
import PencilKit
import PDFKit

/// Native PDF signing surface (DocuSeal parity, no external API key).
/// Presents a PDF page and a signature pad; composing the signature onto the
/// PDF produces a new PDF that can be shared or saved to the artifact library.
struct PDFSignView: View {
    let sourceURL: URL?
    @StateObject private var canvasView = SignatureCanvas()
    @State private var signedPDF: Data? = nil
    @State private var shareURL: URL? = nil
    @State private var isClearing = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                signaturePad
                    .frame(height: 180)
                    .padding(16)

                Divider().background(Color("BorderSubtle"))

                pdfPreview
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                actionBar
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
            }
            .background(Color("BgPrimary").ignoresSafeArea())
            .navigationTitle("Sign PDF")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(isPresented: Binding(
                get: { shareURL != nil },
                set: { if !$0 { shareURL = nil } }
            )) {
                if let url = shareURL {
                    ShareSheet(items: [url])
                }
            }
        }
    }

    private var signaturePad: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Draw signature")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                Spacer()
                Button(action: {
                    canvasView.clear()
                    signedPDF = nil
                }) {
                    Text("Clear")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color("AccentPrimary"))
                }
            }

            ZStack {
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .fill(Color("BgSecondary"))
                SignatureCanvasView(canvasView: canvasView.canvas)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
            }
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .stroke(Color("BorderSubtle").opacity(0.55), lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var pdfPreview: some View {
        if let data = signedPDF, let pdf = PDFDocument(data: data) {
            PDFKitView(document: pdf)
                .padding(16)
        } else if let url = sourceURL, let pdf = PDFDocument(url: url) {
            PDFKitView(document: pdf)
                .padding(16)
        } else {
            FriendlyStateView(
                style: .empty,
                icon: "doc.text",
                title: "No PDF loaded",
                message: "Select a PDF to sign and share."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button(action: {
                canvasView.clear()
                signedPDF = nil
            }) {
                Text("Clear")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.radiusMD)
                            .stroke(Color("BorderSubtle"), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            Button(action: applySignature) {
                Text("Sign & Share")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Color("AccentPrimary"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            }
            .buttonStyle(.plain)
            .disabled(canvasView.isEmpty)
            .opacity(canvasView.isEmpty ? 0.6 : 1)
        }
    }

    private func applySignature() {
        guard let signature = canvasView.signatureImage else { return }
        let basePDF: PDFDocument
        if let url = sourceURL, let doc = PDFDocument(url: url) {
            basePDF = doc
        } else {
            basePDF = blankPDF()
        }
        guard let page = basePDF.page(at: 0) else { return }

        let pageBounds = page.bounds(for: .mediaBox)
        let signatureSize = CGSize(width: 200, height: 80)
        let signatureOrigin = CGPoint(
            x: pageBounds.width - signatureSize.width - 40,
            y: pageBounds.height - signatureSize.height - 40
        )

        UIGraphicsBeginImageContextWithOptions(pageBounds.size, false, 0)
        guard let context = UIGraphicsGetCurrentContext() else { return }
        page.draw(with: .mediaBox, to: context)
        signature.draw(in: CGRect(origin: signatureOrigin, size: signatureSize))
        let composedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()

        guard let composedImage else { return }

        let newPDF = PDFDocument()
        if let imagePage = PDFPage(image: composedImage) {
            newPDF.insert(imagePage, at: 0)
        }
        signedPDF = newPDF.dataRepresentation()

        // Share the signed PDF to a temporary file.
        if let signedData = signedPDF {
            let temp = FileManager.default.temporaryDirectory
                .appendingPathComponent("signed-\(UUID().uuidString).pdf")
            try? signedData.write(to: temp)
            shareURL = temp
        }

        // Persist to the artifact library so it can be re-opened from Saved Artifacts.
        if let signedData = signedPDF {
            saveSignedPDFToLibrary(data: signedData)
        }
    }

    private func saveSignedPDFToLibrary(data: Data) {
        let fileName = "signed-\(UUID().uuidString).pdf"
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        let fileURL = docs.appendingPathComponent(fileName)
        do {
            try data.write(to: fileURL, options: .atomic)
            let record = ArtifactRecord(
                id: fileName,
                title: sourceURL?.lastPathComponent ?? "Signed PDF",
                fileType: "pdf",
                artifactId: fileName,
                artifactType: "pdf",
                url: fileURL.absoluteString,
                inlinePreview: "Signed PDF — \(Int(Date().timeIntervalSince1970))"
            )
            ArtifactLibraryStore.shared.record(record, sessionId: nil)
        } catch {
            // Best-effort local persistence; share sheet still worked.
        }
    }

    private func blankPDF() -> PDFDocument {
        let format = UIGraphicsPDFRendererFormat()
        let pageSize = CGSize(width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize), format: format)
        let data = renderer.pdfData { _ in }
        return PDFDocument(data: data) ?? PDFDocument()
    }
}

// MARK: - Signature canvas model

@MainActor
final class SignatureCanvas: ObservableObject {
    let canvas = PKCanvasView()
    @Published var isEmpty = true

    init() {
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: .black, width: 2)
        canvas.delegate = SignatureDelegate(parent: self)
    }

    func clear() {
        canvas.drawing = PKDrawing()
        isEmpty = true
    }

    var signatureImage: UIImage? {
        let drawing = canvas.drawing
        guard !drawing.bounds.isEmpty else { return nil }
        let image = drawing.image(from: drawing.bounds, scale: UIScreen.main.scale)
        return image.withRenderingMode(.alwaysOriginal)
    }

    private class SignatureDelegate: NSObject, PKCanvasViewDelegate {
        weak var parent: SignatureCanvas?
        init(parent: SignatureCanvas) { self.parent = parent }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent?.isEmpty = canvasView.drawing.bounds.isEmpty
        }
    }
}

// MARK: - UIViewRepresentable wrappers

private struct SignatureCanvasView: UIViewRepresentable {
    let canvasView: PKCanvasView

    func makeUIView(context: Context) -> PKCanvasView {
        canvasView
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {}
}

private struct PDFKitView: UIViewRepresentable {
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

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
