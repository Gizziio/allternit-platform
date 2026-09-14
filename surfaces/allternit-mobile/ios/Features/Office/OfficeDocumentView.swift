import SwiftUI

/// Read-only office document screen.
///
/// Renders an artifact-service document fetched from the backend
/// (`GET v1/artifacts/:id`) using the section mapping the web editors write:
///
/// - `docs-editor/<blockType>` — one block per section (Document)
/// - `slides-editor/slide` — one slide per section, lines in the body
/// - `sheets-editor/sheet` — one worksheet per section, TSV body → grid
/// - `pdf-viewer/page` — one page per section (extracted text)
///
/// This is intentionally READ-ONLY on iOS (Phase 4 scope): the interactive
/// editor is one tap away via `OfficeEditorWebView`, but nothing here mutates
/// the artifact.
struct OfficeDocumentView: View {
    let artifactId: String

    @State private var artifact: OfficeArtifact?
    @State private var error: String?
    @State private var isLoading = true
    @State private var showingEditor = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading document…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error {
                FriendlyStateView(
                    style: .offline,
                    icon: "wifi.slash",
                    title: "Couldn't load document",
                    message: FriendlyErrorMessage.from(error),
                    actionTitle: "Retry",
                    action: { Task { await loadDocument() } }
                )
            } else if let artifact, !artifact.sections.isEmpty {
                documentBody(artifact)
            } else {
                FriendlyStateView(
                    style: .empty,
                    icon: "doc.questionmark",
                    title: "No office content",
                    message: "This artifact has no office-editor sections."
                )
            }
        }
        .navigationTitle(artifact?.title ?? "Document")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color("BgPrimary").ignoresSafeArea())
        .toolbar {
            if let artifact, artifact.officeFamily != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingEditor = true
                    } label: {
                        Label("Interactive", systemImage: "arrow.up.forward.app")
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditor) {
            if let family = artifact?.officeFamily {
                OfficeEditorWebView(family: family, artifactId: artifactId)
                    .ignoresSafeArea()
            }
        }
        .task {
            await loadDocument()
        }
    }

    private func loadDocument() async {
        do {
            artifact = try await OfficeArtifactClient.shared.getArtifact(id: artifactId)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    @ViewBuilder
    private func documentBody(_ artifact: OfficeArtifact) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                ForEach(Array(artifact.orderedSections.enumerated()), id: \.element.id) { index, section in
                    switch artifact.officeFamily {
                    case .slides:
                        slideCard(section, number: index + 1)
                    case .sheets:
                        sheetCard(section)
                    case .pdf:
                        pageCard(section, number: index + 1)
                    default:
                        docBlock(section)
                    }
                }
            }
            .padding(20)
        }
    }

    /// docs-editor: one paragraph/heading block per section.
    private func docBlock(_ section: OfficeArtifactSection) -> some View {
        let isHeading = section.kind.hasSuffix("/heading")
        return Text(section.body)
            .font(isHeading ? .title3.bold() : .body)
            .foregroundColor(Color("TextPrimary"))
            .frame(maxWidth: .infinity, alignment: .leading)
            .textSelection(.enabled)
    }

    /// slides-editor: one card per slide, one line per paragraph.
    private func slideCard(_ section: OfficeArtifactSection, number: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Slide \(number)")
                .font(.caption.bold())
                .foregroundColor(Color("AccentPrimary"))
            ForEach(Array(section.body.split(separator: "\n", omittingEmptySubsequences: true).enumerated()), id: \.offset) { _, line in
                Text(line)
                    .font(.body)
                    .foregroundColor(Color("TextPrimary"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color("BgSecondary"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .textSelection(.enabled)
    }

    /// sheets-editor: TSV body rendered as a monospaced grid.
    private func sheetCard(_ section: OfficeArtifactSection) -> some View {
        let rows = section.body.split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.split(separator: "\t", omittingEmptySubsequences: false).map(String.init) }
        return VStack(alignment: .leading, spacing: 8) {
            Text(section.heading?.replacingOccurrences(of: "Sheet: ", with: "") ?? "Sheet")
                .font(.caption.bold())
                .foregroundColor(Color("AccentPrimary"))
            ScrollView(.horizontal) {
                Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        GridRow {
                            ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                                Text(cell)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(Color("TextPrimary"))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .frame(minWidth: 72, alignment: .leading)
                                    .overlay(Rectangle().stroke(Color("BorderSubtle"), lineWidth: 0.5))
                            }
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color("BgSecondary"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .textSelection(.enabled)
    }

    /// pdf-viewer: one extracted-text page per section.
    private func pageCard(_ section: OfficeArtifactSection, number: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Page \(number)")
                .font(.caption.bold())
                .foregroundColor(Color("AccentPrimary"))
            Text(section.body.isEmpty ? "(empty page)" : section.body)
                .font(.body)
                .foregroundColor(Color("TextPrimary"))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(Color("BgSecondary"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .textSelection(.enabled)
    }
}
