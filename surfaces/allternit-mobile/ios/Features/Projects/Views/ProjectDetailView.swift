import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Project detail (Claude iOS project view parity): the project name and
/// description, "Add files" / "Add instructions" entries, the instructions
/// editor (Save → PUT …/projects/:id), the attached-files list, and the
/// "Chats in this project" section (agent sessions stamped with this
/// project's id).
///
/// The old live backend has no files routes and doesn't persist
/// `metadata.projectId` on session create, so the files list renders its
/// error state and the chats section its empty state there; both light up on
/// a backend with the Phase-3 routes.
struct ProjectDetailView: View {
    let project: CoworkProject
    /// "+ New chat": selects this project and starts a fresh conversation
    /// stamped with it (handled by the sidebar, which owns the session id).
    let onNewChat: (CoworkProject) -> Void
    /// Tapping a chat row opens it in Home.
    let onOpenChat: (AgentSession) -> Void

    @StateObject private var projectStore = ProjectStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var instructions: String
    @State private var isEditingInstructions = false
    @State private var isSavingInstructions = false
    @State private var files: [CoworkProjectFile] = []
    @State private var filesError: String? = nil
    @State private var chats: [AgentSession] = []
    @State private var actionError: String? = nil

    @State private var isAddFilesDialogPresented = false
    @State private var isPhotosPickerPresented = false
    @State private var isFilePickerPresented = false
    @State private var selectedPhotoItems: [PhotosPickerItem] = []

    @State private var isRenameAlertPresented = false
    @State private var renameText = ""
    @State private var isDeleteConfirmPresented = false

    private let projectsClient = ProjectsClient()
    private let chatClient = AgentChatClient()

    init(project: CoworkProject,
         onNewChat: @escaping (CoworkProject) -> Void,
         onOpenChat: @escaping (AgentSession) -> Void) {
        self.project = project
        self.onNewChat = onNewChat
        self.onOpenChat = onOpenChat
        _instructions = State(initialValue: project.instructions ?? "")
        _isEditingInstructions = State(initialValue: (project.instructions ?? "").isEmpty)
    }

    /// The live store record (rename/instructions saves land here); falls
    /// back to the value captured on push.
    private var liveProject: CoworkProject {
        projectStore.project(withId: project.id) ?? project
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let actionError {
                    Text(actionError)
                        .font(.caption)
                        .foregroundColor(Theme.statusWarning)
                }

                descriptionSection
                addButtonsRow
                instructionsSection
                filesSection
                chatsSection
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .navigationTitle(liveProject.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(action: {
                        renameText = liveProject.title
                        isRenameAlertPresented = true
                    }) {
                        Label("Rename", systemImage: "pencil")
                    }
                    Button(role: .destructive, action: { isDeleteConfirmPresented = true }) {
                        Label("Delete project", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color("TextSecondary"))
                }
                .accessibilityLabel("Project options")
            }
        }
        .alert("Rename project", isPresented: $isRenameAlertPresented) {
            TextField("Project name", text: $renameText)
            Button("Save") { renameProject() }
                .disabled(renameText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            Button("Cancel", role: .cancel) {}
        }
        .alert("Delete this project?", isPresented: $isDeleteConfirmPresented) {
            Button("Delete", role: .destructive) { deleteProject() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its chats are kept, but they're no longer grouped under a project.")
        }
        .confirmationDialog("Add files", isPresented: $isAddFilesDialogPresented, titleVisibility: .visible) {
            Button("Photos") { isPhotosPickerPresented = true }
            Button("Files") { isFilePickerPresented = true }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $isPhotosPickerPresented,
            selection: $selectedPhotoItems,
            maxSelectionCount: 5,
            matching: .images
        )
        .sheet(isPresented: $isFilePickerPresented) {
            DocumentPicker { url in stagePickedFile(url) }
        }
        .onChange(of: selectedPhotoItems) { _, items in
            guard !items.isEmpty else { return }
            stagePickedPhotos(items)
            selectedPhotoItems = []
        }
        .task {
            await loadFiles()
            await loadChats()
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var descriptionSection: some View {
        if let description = liveProject.description, !description.isEmpty {
            Text(description)
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
        }
    }

    /// Claude's project page leads with these two affordances.
    private var addButtonsRow: some View {
        HStack(spacing: 12) {
            addButton(icon: "doc.badge.plus", label: "Add files") {
                isAddFilesDialogPresented = true
            }
            addButton(icon: "text.badge.plus", label: "Add instructions") {
                isEditingInstructions = true
            }
        }
    }

    private func addButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .medium))
                Text(label)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundColor(Color("TextPrimary"))
            .frame(maxWidth: .infinity)
            .frame(height: 76)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: Instructions

    private var instructionsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Instructions")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))

            if isEditingInstructions {
                TextEditor(text: $instructions)
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 120)
                    .padding(10)
                    .background(Color("BgPanel"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusMD)
                            .stroke(Theme.borderWarmDefault, lineWidth: 1)
                    )

                HStack(spacing: 12) {
                    Button(action: saveInstructions) {
                        Text(isSavingInstructions ? "Saving…" : "Save")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("BgPrimary"))
                            .padding(.horizontal, 14)
                            .frame(height: 32)
                            .background(Color("AccentPrimary"))
                            .clipShape(Capsule())
                    }
                    .disabled(isSavingInstructions)

                    if !(liveProject.instructions ?? "").isEmpty {
                        Button("Cancel") {
                            instructions = liveProject.instructions ?? ""
                            isEditingInstructions = false
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color("TextSecondary"))
                    }
                }
            } else {
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    isEditingInstructions = true
                }) {
                    Text(liveProject.instructions ?? "")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Color("BgPanel"))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.radiusMD)
                                .stroke(Theme.borderWarmDefault, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Files

    private var filesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Files")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))

            if let filesError {
                FriendlyInlineStateView(
                    style: .error,
                    icon: "exclamationmark.triangle",
                    title: "Couldn't load files",
                    message: FriendlyErrorMessage.from(filesError),
                    actionTitle: "Retry",
                    action: {
                        Task { await loadFiles() }
                    }
                )
            } else if files.isEmpty {
                FriendlyInlineStateView(
                    style: .empty,
                    icon: "folder",
                    title: "No files yet",
                    message: "Add files to give every chat in this project the same context."
                )
            } else {
                VStack(spacing: 8) {
                    ForEach(files) { file in
                        fileRow(file)
                    }
                }
            }
        }
    }

    private func fileRow(_ file: CoworkProjectFile) -> some View {
        HStack(spacing: 12) {
            Image(systemName: Self.icon(for: file.mediaType))
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(file.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                if let mediaType = file.mediaType {
                    Text(mediaType)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
            }
            Spacer()
            Button(action: { deleteFile(file) }) {
                Image(systemName: "trash")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private static func icon(for mediaType: String?) -> String {
        guard let mediaType else { return "doc" }
        if mediaType.hasPrefix("image/") { return "photo" }
        if mediaType == "application/pdf" { return "doc.richtext" }
        if mediaType.hasPrefix("text/") { return "doc.text" }
        return "doc"
    }

    // MARK: Chats

    private var chatsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Chats in this project")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                Spacer()
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    onNewChat(liveProject)
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .semibold))
                        Text("New chat")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(Color("TextPrimary"))
                    .padding(.horizontal, 14)
                    .frame(height: 32)
                    .background(Color("BgSecondary"))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color("BorderSubtle"), lineWidth: 1))
                }
            }

            if chats.isEmpty {
                FriendlyInlineStateView(
                    style: .empty,
                    icon: "bubble.left",
                    title: "No chats yet",
                    message: "Start a conversation to see it here."
                )
            } else {
                VStack(spacing: 8) {
                    ForEach(chats) { session in
                        Button(action: {
                            let generator = UIImpactFeedbackGenerator(style: .light)
                            generator.impactOccurred()
                            onOpenChat(session)
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: "bubble.left")
                                    .font(.subheadline)
                                    .foregroundColor(Color("TextSecondary"))
                                Text(session.name ?? "Untitled")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(Color("TextPrimary"))
                                    .lineLimit(1)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color("TextSecondary"))
                            }
                            .padding(.horizontal, 14)
                            .frame(height: 48)
                            .background(Color("BgPanel"))
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.radiusMD)
                                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
                            )
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func renameProject() {
        let title = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, title != liveProject.title else { return }
        Task {
            do {
                try await projectStore.renameProject(id: project.id, title: title)
            } catch {
                actionError = "Couldn't rename the project: \(error.localizedDescription)"
            }
        }
    }

    private func deleteProject() {
        Task {
            do {
                try await projectStore.deleteProject(id: project.id)
                dismiss()
            } catch {
                actionError = "Couldn't delete the project: \(error.localizedDescription)"
            }
        }
    }

    private func saveInstructions() {
        isSavingInstructions = true
        Task {
            do {
                try await projectStore.saveInstructions(id: project.id, instructions: instructions)
                isEditingInstructions = instructions.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            } catch {
                actionError = "Couldn't save instructions: \(error.localizedDescription)"
            }
            isSavingInstructions = false
        }
    }

    private func loadFiles() async {
        do {
            files = try await projectsClient.listFiles(projectId: project.id)
            filesError = nil
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            filesError = error.localizedDescription
        }
    }

    /// Chats stamped with this project's id — filtered client-side on
    /// `metadata.project_id` (AgentSession.projectId).
    private func loadChats() async {
        do {
            let envelope: AgentSessionListResponse = try await APIClient.shared.get(path: "agent-sessions")
            chats = envelope.sessions
                .filter { $0.projectId == project.id }
                .sorted { $0.updatedAt > $1.updatedAt }
        } catch {
            // The section falls back to its empty state; the banner above
            // already carries the failure when it's actionable.
        }
    }

    // MARK: - File staging (Add files)

    private func stagePickedPhotos(_ items: [PhotosPickerItem]) {
        Task {
            for (index, item) in items.enumerated() {
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                let mediaType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
                await attachFile(data: data, filename: "photo-\(index + 1).jpg", mediaType: mediaType)
            }
        }
    }

    private func stagePickedFile(_ url: URL) {
        guard let data = try? Data(contentsOf: url) else {
            filesError = "Couldn't read that file."
            return
        }
        let mediaType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
            ?? "application/octet-stream"
        Task { await attachFile(data: data, filename: url.lastPathComponent, mediaType: mediaType) }
    }

    /// Uploads the blob (POST /api/v1/uploads), then records the metadata
    /// row on the project. A failure on either call surfaces under the Files
    /// section.
    private func attachFile(data: Data, filename: String, mediaType: String) async {
        do {
            let upload = try await chatClient.upload(
                name: filename,
                mediaType: mediaType,
                dataBase64: data.base64EncodedString()
            )
            try await projectsClient.addFile(
                projectId: project.id,
                name: filename,
                url: upload.url,
                uploadId: upload.uploadId,
                mediaType: mediaType
            )
            await loadFiles()
        } catch {
            filesError = "Couldn't attach \(filename): \(error.localizedDescription)"
        }
    }

    private func deleteFile(_ file: CoworkProjectFile) {
        Task {
            do {
                try await projectsClient.deleteFile(projectId: project.id, fileId: file.id)
                files.removeAll { $0.id == file.id }
            } catch {
                filesError = "Couldn't remove \(file.name): \(error.localizedDescription)"
            }
        }
    }
}
