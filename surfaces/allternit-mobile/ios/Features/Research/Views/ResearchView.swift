import SwiftUI

/// Research tab surface — mirrors the web's `ResearchTab` inside A://Labs.
///
/// Phase 1: notebook list, source management, and simple chat against the
/// Open Notebook backend (port 5055). Source upload, streaming, search, and
/// Canvas sync are deferred.
struct ResearchView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var store = ResearchStore.shared

    @State private var isCreateSheetPresented = false
    @State private var newNotebookTitle = ""
    @State private var newNotebookDescription = ""
    @State private var newSourceTitle = ""
    @State private var newSourceContent = ""
    @State private var messageText = ""
    @State private var actionError: String? = nil

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
        .sheet(isPresented: $isCreateSheetPresented) {
            createNotebookSheet
        }
        .task {
            store.checkHealthAndLoad()
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

            Text("Research")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isCreateSheetPresented = true
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
        if store.apiAvailable == false {
            Spacer()
            unavailableState
            Spacer()
        } else if store.isLoading && store.notebooks.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.notebooks.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't load research notebooks")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    Task { await store.loadNotebooks() }
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else if store.notebooks.isEmpty {
            Spacer()
            emptyNotebooksState
            Spacer()
        } else if let notebook = store.activeNotebook {
            notebookDetail(notebook)
        } else {
            Spacer()
            emptyNotebooksState
            Spacer()
        }
    }

    // MARK: - Notebook detail

    private func notebookDetail(_ notebook: ResearchNotebook) -> some View {
        VStack(spacing: 0) {
            // Notebook selector + info
            VStack(alignment: .leading, spacing: 8) {
                Picker("Notebook", selection: $store.activeNotebookId) {
                    ForEach(store.notebooks) { nb in
                        Text(nb.title).tag(nb.id as String?)
                    }
                }
                .pickerStyle(.menu)
                .font(.subheadline)

                HStack(spacing: 12) {
                    Label("\(notebook.sourceCount) sources", systemImage: "doc.text")
                    Label("\(notebook.tokenCount) tokens", systemImage: "chart.bar")
                }
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))

                if let actionError {
                    Text(actionError)
                        .font(.caption)
                        .foregroundColor(Theme.statusWarning)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider().background(Color("BorderSubtle"))

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    sourcesSection
                    messagesSection
                }
                .padding(.vertical, 16)
            }
            .scrollDismissesKeyboard(.interactively)

            Divider().background(Color("BorderSubtle"))

            composer
        }
    }

    // MARK: - Sources

    private var sourcesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Sources")
                    .font(.headline)
                    .foregroundColor(Color("TextPrimary"))
                Spacer()
                Text("\(store.sources.count)")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
            .padding(.horizontal, 16)

            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    TextField("Source title", text: $newSourceTitle)
                        .font(.subheadline)
                        .textInputAutocapitalization(.never)
                    Button("Add") {
                        addTextSource()
                    }
                    .font(.subheadline)
                    .foregroundColor(Color("AccentPrimary"))
                    .disabled(newSourceTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || newSourceContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                TextEditor(text: $newSourceContent)
                    .font(.caption)
                    .frame(minHeight: 60, maxHeight: 100)
                    .padding(8)
                    .background(Color("BgSecondary"))
                    .cornerRadius(8)
            }
            .padding(.horizontal, 16)

            if store.sources.isEmpty {
                Text("No sources yet — add text above.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .padding(.horizontal, 16)
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(store.sources) { source in
                        sourceRow(source)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private func sourceRow(_ source: ResearchSource) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(source.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                Text("\(source.type) · \(source.tokenCount) tokens · \(source.status)")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
            Spacer()
            Button(action: { removeSource(source) }) {
                Image(systemName: "trash")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
            }
        }
        .padding(12)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    // MARK: - Messages

    private var messagesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Chat")
                .font(.headline)
                .foregroundColor(Color("TextPrimary"))
                .padding(.horizontal, 16)

            if store.messages.isEmpty {
                Text("Ask a question about your sources.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .padding(.horizontal, 16)
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(store.messages) { message in
                        messageBubble(message)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private func messageBubble(_ message: ResearchChatMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 40) }
            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.subheadline)
                    .foregroundColor(message.role == "user" ? Color("BgPrimary") : Color("TextPrimary"))
                    .padding(12)
                    .background(message.role == "user" ? Color("AccentPrimary") : Color("BgPanel"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            }
            if message.role != "user" { Spacer(minLength: 40) }
        }
    }

    // MARK: - Composer

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Ask about your sources…", text: $messageText, axis: .vertical)
                .font(.subheadline)
                .lineLimit(1...4)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button(action: { sendMessage() }) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color("BgPrimary"))
                    .frame(width: 32, height: 32)
                    .background(Color("AccentPrimary"))
                    .clipShape(Circle())
            }
            .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color("BgSecondary"))
    }

    // MARK: - Empty / unavailable

    private var emptyNotebooksState: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("No research notebooks yet.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
            Button(action: { isCreateSheetPresented = true }) {
                Text("Create notebook")
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

    private var unavailableState: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("Research backend unavailable.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Text("Open Notebook must be running on http://127.0.0.1:5055.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    // MARK: - Create sheet

    private var createNotebookSheet: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    Button("Cancel") { isCreateSheetPresented = false }
                        .font(.subheadline)
                        .foregroundColor(Color("TextSecondary"))
                    Spacer()
                    Text("New Notebook")
                        .font(.headline)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Button("Create") { createNotebook() }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("AccentPrimary"))
                        .disabled(newNotebookTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color("BgPrimary"))

                Divider().background(Color("BorderSubtle"))

                VStack(spacing: 16) {
                    TextField("Notebook title", text: $newNotebookTitle)
                        .font(.subheadline)
                        .textInputAutocapitalization(.never)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color("BgSecondary"))
                        .cornerRadius(10)

                    TextField("Description (optional)", text: $newNotebookDescription)
                        .font(.subheadline)
                        .textInputAutocapitalization(.never)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color("BgSecondary"))
                        .cornerRadius(10)

                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    // MARK: - Actions

    private func createNotebook() {
        let title = newNotebookTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let description = newNotebookDescription.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        Task {
            do {
                try await store.createNotebook(title: title, description: description)
                newNotebookTitle = ""
                newNotebookDescription = ""
                actionError = nil
                isCreateSheetPresented = false
            } catch {
                actionError = "Couldn't create notebook: \(error.localizedDescription)"
            }
        }
    }

    private func addTextSource() {
        let title = newSourceTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = newSourceContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !content.isEmpty else { return }
        Task {
            do {
                try await store.addTextSource(title: title, content: content)
                newSourceTitle = ""
                newSourceContent = ""
                actionError = nil
            } catch {
                actionError = "Couldn't add source: \(error.localizedDescription)"
            }
        }
    }

    private func removeSource(_ source: ResearchSource) {
        Task {
            do {
                try await store.removeSource(id: source.id)
                actionError = nil
            } catch {
                actionError = "Couldn't remove source: \(error.localizedDescription)"
            }
        }
    }

    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        Task {
            do {
                try await store.sendMessage(text)
                messageText = ""
                actionError = nil
            } catch {
                actionError = "Couldn't send message: \(error.localizedDescription)"
            }
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}
