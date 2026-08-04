import SwiftUI

/// Documents tab surface — phase 1: import, list, preview, share, and delete
/// office files. Editing (docx/xlsx/pptx mutation) is intentionally deferred
/// to a later phase; it mirrors the web's `office-io` packs but is a much
/// larger native undertaking.
struct DocumentsView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var store = DocumentsStore.shared
    @State private var isImporterPresented = false
    @State private var previewFile: DocumentFile? = nil
    @State private var editingFile: DocumentFile? = nil
    @State private var editTitle = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $isImporterPresented) {
            DocumentImporter(isPresented: $isImporterPresented) { urls in
                Task {
                    await store.importFiles(from: urls)
                }
            }
        }
        .sheet(item: $previewFile) { file in
            DocumentPreviewView(file: file, store: store)
        }
        .sheet(item: $editingFile) { file in
            DocumentRenameSheet(
                title: file.displayTitle,
                onSave: { newTitle in
                    store.updateTitle(for: file, to: newTitle)
                    editingFile = nil
                },
                onCancel: { editingFile = nil }
            )
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0)) {
                    isSidebarOpen.toggle()
                }
            }) {
                Image(systemName: "line.3.horizontal")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
                    .frame(width: 44, height: 44)
            }

            Text("Documents")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isImporterPresented = true
            }) {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.files.isEmpty {
            emptyState
        } else {
            listContent
        }
    }

    private var listContent: some View {
        List {
            if let error = store.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
                    .listRowBackground(Color.clear)
            }

            ForEach(store.files) { file in
                DocumentRow(file: file, store: store)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        previewFile = file
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            store.delete(file)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .contextMenu {
                        Button {
                            previewFile = file
                        } label: {
                            Label("Preview", systemImage: "eye")
                        }

                        Button {
                            editingFile = file
                        } label: {
                            Label("Rename", systemImage: "pencil")
                        }

                        ShareLink(item: store.url(for: file)) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }

                        Button(role: .destructive) {
                            store.delete(file)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
        .background(Color("BgPrimary"))
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )

            Text("No documents yet.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))

            Text("Import Word, Excel, PowerPoint, PDF, text, or Markdown files from your device.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button(action: { isImporterPresented = true }) {
                Text("Import document")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .background(Color("BgSecondary"))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color("BorderSubtle"), lineWidth: 1))
            }
        }
    }
}

// MARK: - Row

private struct DocumentRow: View {
    let file: DocumentFile
    @ObservedObject var store: DocumentsStore

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: file.kind.icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 40, height: 40)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            VStack(alignment: .leading, spacing: 2) {
                Text(file.displayTitle)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(file.kind.label)
                        .font(.caption)
                    Text("·")
                        .font(.caption)
                    Text(file.updatedAt, style: .date)
                        .font(.caption)
                }
                .foregroundColor(Color("TextSecondary"))
            }

            Spacer()
        }
        .padding(.vertical, 4)
        .background(Color("BgPrimary"))
    }
}

// MARK: - Rename sheet

private struct DocumentRenameSheet: View {
    let title: String
    var onSave: (String) -> Void
    var onCancel: () -> Void

    @State private var draft: String = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    Button("Cancel", action: onCancel)
                        .font(.subheadline)
                        .foregroundColor(Color("TextSecondary"))

                    Spacer()

                    Text("Rename")
                        .font(.headline)
                        .foregroundColor(Color("TextPrimary"))

                    Spacer()

                    Button("Save") {
                        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty {
                            onSave(trimmed)
                        }
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("AccentPrimary"))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color("BgPrimary"))

                Divider().background(Color("BorderSubtle"))

                TextField("Document title", text: $draft)
                    .font(.subheadline)
                    .textInputAutocapitalization(.never)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color("BgSecondary"))
                    .cornerRadius(10)
                    .padding(20)

                Spacer()
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
        .onAppear { draft = title }
    }
}
