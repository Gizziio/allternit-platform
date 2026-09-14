import AVFoundation
import Photos
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The composer "+" button's sheet (Claude iOS "Add to Chat" parity).
/// Polished glass modal with a compact icon grid, GitHub fetch, Web search /
/// Research toggles, a Style submenu, recent photos, project selection, tool
/// access, permissions, and the Connectors entry. Picks stage into the shared
/// `AttachmentStore` and render as the thumbnail strip above the composer text
/// field.
struct ComposerPlusSheet: View {
    @ObservedObject var attachmentStore: AttachmentStore

    @StateObject private var toolOptions = ToolOptionsStore.shared
    @StateObject private var projectStore = ProjectStore.shared
    @StateObject private var brainStore = BrainStore.shared
    @EnvironmentObject private var agentModeStore: AgentModeStore
    @Environment(\.dismiss) private var dismiss

    /// Recent-library thumbnails (latest 12), loaded once photo access is granted.
    @State private var recentAssets: [PHAsset] = []
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var isPhotosPickerPresented = false
    @State private var isCameraPresented = false
    @State private var isFilePickerPresented = false
    @State private var isConnectorsPresented = false
    @State private var isBrainCapturePresented = false
    @State private var isCoworkTasksPresented = false
    @State private var isAgentActivityPresented = false
    /// Set to present the app-owned priming sheet before a system prompt.
    @State private var primingPermission: AppPermission? = nil
    /// Whether granting photo access from the priming sheet should also open
    /// the picker (Photos button) or just reveal the recents strip
    /// ("Show recent photos" row).
    @State private var openPickerAfterPriming = false
    /// Non-permission failures (camera unavailable, unreadable file).
    @State private var pickerError: String? = nil

    /// GitHub file fetch state (ChatComposer.tsx parity).
    @State private var githubUrl = ""
    @State private var isGitHubInputVisible = false
    @State private var isGitHubLoading = false

    /// Active inline submenu: project list or style list.
    @State private var activeSubMenu: PlusSubMenu? = nil

    private enum PlusSubMenu: String {
        case project
        case style
    }

    /// DEBUG: `-open-plus-sheet` pins the sheet to .large so screenshot
    /// verification can see every section (simctl can't scroll sheets).
    private static var sheetDetents: Set<PresentationDetent> {
        #if DEBUG
        if launchArgumentEnabled("open-plus-sheet") { return [.large] }
        #endif
        return [.medium, .large]
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header — compact, with a drag indicator and close button.
            HStack {
                RoundedRectangle(cornerRadius: 2.5)
                    .fill(Color("TextSecondary").opacity(0.35))
                    .frame(width: 36, height: 5)
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color("TextSecondary"))
                        .frame(width: 32, height: 32)
                        .background(.ultraThinMaterial, in: Circle())
                        .overlay(Circle().stroke(Color("BorderSubtle"), lineWidth: 1))
                }
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 10)

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if let pickerError {
                        errorBanner(pickerError)
                    }

                    iconGrid

                    if isGitHubInputVisible {
                        githubInputSection
                    }

                    if activeSubMenu == .style {
                        styleSubMenu
                    }

                    if activeSubMenu == .project {
                        projectSubMenu
                    }

                    recentPhotosSection
                    toolTogglesSection
                    toolAccessSection
                    projectRow
                    permissionsRow
                    coworkTasksRow
                    agentActivityRow
                    connectorsRow
                    brainCaptureRow
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
        }
        .background(
            ZStack {
                Color("BgPrimary").opacity(0.72)
                Rectangle().fill(.ultraThinMaterial)
            }
            .edgesIgnoringSafeArea(.all)
        )
        .presentationDetents(Self.sheetDetents)
        .photosPicker(
            isPresented: $isPhotosPickerPresented,
            selection: $selectedPhotoItems,
            maxSelectionCount: 5,
            matching: .images
        )
        .sheet(isPresented: $isCameraPresented) {
            CameraPicker { image in stageCameraImage(image) }
                .ignoresSafeArea()
        }
        .sheet(isPresented: $isFilePickerPresented) {
            DocumentPicker { url in stageFile(url) }
        }
        .sheet(isPresented: $isConnectorsPresented) {
            ConnectorsListView()
        }
        .sheet(isPresented: $isCoworkTasksPresented) {
            CoworkTasksListView()
        }
        .sheet(isPresented: $isAgentActivityPresented) {
            AgentActivityListView()
        }
        .sheet(isPresented: $isBrainCapturePresented) {
            BrainCaptureSheet()
        }
        .sheet(item: $primingPermission) { permission in
            PermissionPrimingSheet(permission: permission) {
                handlePrimingContinue(permission)
            }
        }
        .onChange(of: selectedPhotoItems) { _, items in
            guard !items.isEmpty else { return }
            stagePickedPhotos(items)
            selectedPhotoItems = []
        }
        .onAppear { loadRecentPhotos() }
    }

    private func errorBanner(_ message: String) -> some View {
        FriendlyInlineStateView(
            style: .error,
            icon: "exclamationmark.triangle.fill",
            title: "Something went wrong",
            message: message
        )
    }

    // MARK: - Icon grid

    private var iconGrid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 4)
        return LazyVGrid(columns: columns, spacing: 10) {
            gridButton(icon: "camera", label: "Camera", action: cameraTapped)
            gridButton(icon: "photo.on.rectangle", label: "Photos", action: photosTapped)
            gridButton(icon: "folder", label: "Files", action: {
                hapticLight()
                isFilePickerPresented = true
                activeSubMenu = nil
            })
            gridButton(
                icon: "link",
                label: "GitHub",
                isActive: isGitHubInputVisible,
                action: {
                    hapticLight()
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isGitHubInputVisible.toggle()
                        activeSubMenu = nil
                    }
                }
            )
            gridButton(
                icon: "globe",
                label: "Web",
                isActive: toolOptions.webSearch,
                showCheck: toolOptions.webSearch,
                action: {
                    hapticLight()
                    toolOptions.webSearch.toggle()
                    activeSubMenu = nil
                }
            )
            gridButton(
                icon: "paintbrush",
                label: toolOptions.activeStyle?.label ?? "Style",
                isActive: activeSubMenu == .style || toolOptions.activeStyle != nil,
                action: {
                    hapticLight()
                    withAnimation(.easeInOut(duration: 0.2)) {
                        activeSubMenu = activeSubMenu == .style ? nil : .style
                        isGitHubInputVisible = false
                    }
                }
            )
            gridButton(
                icon: "puzzlepiece.extension",
                label: "Connectors",
                action: {
                    hapticLight()
                    isConnectorsPresented = true
                    activeSubMenu = nil
                }
            )
            gridButton(
                icon: "folder.badge.plus",
                label: "Project",
                isActive: activeSubMenu == .project,
                action: {
                    hapticLight()
                    withAnimation(.easeInOut(duration: 0.2)) {
                        activeSubMenu = activeSubMenu == .project ? nil : .project
                        isGitHubInputVisible = false
                    }
                }
            )
        }
    }

    private func gridButton(
        icon: String,
        label: String,
        isActive: Bool = false,
        showCheck: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                ZStack {
                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(isActive ? Color("AccentPrimary") : Color("TextPrimary"))
                    if showCheck {
                        VStack {
                            HStack { Spacer() }
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Color("AccentPrimary"))
                                .offset(x: 10, y: 8)
                        }
                    }
                }
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .fill(isActive ? Color("AccentPrimary").opacity(0.14) : Color("BgPanel").opacity(0.55))
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.radiusMD))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(isActive ? Color("AccentPrimary").opacity(0.45) : Color("BorderSubtle").opacity(0.55), lineWidth: 1)
                )

                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(isActive ? Color("AccentPrimary") : Color("TextPrimary"))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - GitHub fetch

    private var githubInputSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "link")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color("TextSecondary"))
                TextField("github.com/user/repo/blob/main/file", text: $githubUrl)
                    .font(.system(size: 13))
                    .foregroundColor(Color("TextPrimary"))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .submitLabel(.done)
                    .onSubmit { fetchGitHubFile() }
                if isGitHubLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                } else {
                    Button(action: fetchGitHubFile) {
                        Text("Add")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color("AccentPrimary"))
                    }
                    .disabled(githubUrl.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 44)
            .background(Color("BgSecondary").opacity(0.45))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            Text("Paste a GitHub file URL to fetch its raw contents as an attachment.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        }
        .glassPanel()
    }

    private func fetchGitHubFile() {
        let rawUrl = githubUrl.trimmingCharacters(in: .whitespaces)
        guard !rawUrl.isEmpty else { return }
        isGitHubLoading = true
        Task {
            do {
                let raw = rawUrl
                    .replacingOccurrences(of: "https://github.com/", with: "https://raw.githubusercontent.com/")
                    .replacingOccurrences(of: "/blob/", with: "/")
                guard let url = URL(string: raw) else {
                    throw URLError(.badURL)
                }
                let (data, response) = try await URLSession.shared.data(from: url)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    throw URLError(.badServerResponse)
                }
                let filename = rawUrl.components(separatedBy: "/").last?.components(separatedBy: "?").first ?? "github-file"
                await MainActor.run {
                    attachmentStore.add(StagedAttachment(
                        thumbnail: nil,
                        data: data,
                        filename: filename,
                        mediaType: "text/plain"
                    ))
                    githubUrl = ""
                    isGitHubInputVisible = false
                }
            } catch {
                await MainActor.run {
                    pickerError = "Couldn't fetch that GitHub file."
                }
            }
            await MainActor.run {
                isGitHubLoading = false
            }
        }
    }

    // MARK: - Style submenu

    private var styleSubMenu: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Response style")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))
            VStack(spacing: 4) {
                ForEach(ComposerResponseStyle.allCases, id: \.self) { style in
                    let selected = toolOptions.activeStyle == style
                    Button(action: {
                        hapticLight()
                        toolOptions.activeStyle = selected ? nil : style
                        activeSubMenu = nil
                    }) {
                        HStack(spacing: 10) {
                            Text(style.label)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(Color("TextPrimary"))
                            Spacer()
                            if selected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(Color("AccentPrimary"))
                            }
                        }
                        .padding(.horizontal, 12)
                        .frame(height: 40)
                        .background(selected ? Color("AccentPrimary").opacity(0.10) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .glassPanel()
    }

    // MARK: - Project submenu

    private var projectSubMenu: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Add to project")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                Spacer()
                Button(action: {
                    projectStore.fetchProjectsIfNeeded(force: true)
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color("TextSecondary"))
                }
                .accessibilityLabel("Refresh")
            }
            VStack(spacing: 4) {
                projectSubMenuRow(nil)
                if projectStore.isLoading && projectStore.projects.isEmpty {
                    HStack {
                        Spacer()
                        ProgressView()
                            .scaleEffect(0.8)
                        Spacer()
                    }
                    .padding(.vertical, 8)
                } else {
                    ForEach(projectStore.projects) { project in
                        projectSubMenuRow(project)
                    }
                }
            }
        }
        .glassPanel()
        .onAppear { projectStore.fetchProjectsIfNeeded() }
    }

    private func projectSubMenuRow(_ project: CoworkProject?) -> some View {
        let selected = projectStore.selectedProjectId == project?.id
        return Button(action: {
            hapticLight()
            projectStore.selectedProjectId = project?.id
            activeSubMenu = nil
        }) {
            HStack(spacing: 10) {
                Text(project?.title ?? "None")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                Spacer()
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color("AccentPrimary"))
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(selected ? Color("AccentPrimary").opacity(0.10) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Recent photos

    @ViewBuilder
    private var recentPhotosSection: some View {
        if recentAssets.isEmpty {
            Button(action: showRecentPhotosTapped) {
                HStack(spacing: 10) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color("AccentPrimary"))
                    Text("Show recent photos")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color("TextSecondary"))
                }
            }
            .buttonStyle(.plain)
            .glassPanel()
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("Recent photos")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(recentAssets, id: \.localIdentifier) { asset in
                            Button(action: { stageRecentPhoto(asset) }) {
                                RecentPhotoThumb(asset: asset)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .glassPanel()
        }
    }

    // MARK: - Tool toggles

    private var toolTogglesSection: some View {
        VStack(spacing: 2) {
            toolToggleRow(
                icon: "globe",
                title: "Web search",
                subtitle: "Let the agent search the web for current information",
                isOn: $toolOptions.webSearch
            )
            Divider().background(Color("BorderSubtle").opacity(0.55)).padding(.leading, 44)
            toolToggleRow(
                icon: "book",
                title: "Research",
                subtitle: "Deeper, multi-source research before answering",
                isOn: $toolOptions.research
            )
        }
        .glassPanel()
    }

    private func toolToggleRow(icon: String, title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(Color("AccentPrimary"))
        }
        .padding(.vertical, 6)
    }

    // MARK: - Tool access

    private var toolAccessSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Tool access")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))
            Menu {
                ForEach(ToolAccess.allCases, id: \.self) { access in
                    Button(action: { toolOptions.toolAccess = access }) {
                        Label(access.label, systemImage: toolOptions.toolAccess == access ? "checkmark" : "")
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Text(toolOptions.toolAccess.label)
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(Color("TextSecondary"))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            Text(toolOptions.toolAccess.explainer)
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        }
        .glassPanel()
    }

    // MARK: - Project & permissions

    private var projectRow: some View {
        Menu {
            Button(action: { selectProject(nil) }) {
                HStack {
                    if projectStore.selectedProjectId == nil {
                        Image(systemName: "checkmark")
                    }
                    Text("None")
                }
            }
            if projectStore.isLoading && projectStore.projects.isEmpty {
                FriendlyInlineStateView(
                    style: .empty,
                    icon: "arrow.clockwise",
                    title: "Loading projects",
                    message: "Hang tight…"
                )
            } else if let loadError = projectStore.loadError, projectStore.projects.isEmpty {
                let isOffline = loadError.lowercased().contains("could not connect")
                    || loadError.lowercased().contains("failed to connect")
                FriendlyInlineStateView(
                    style: isOffline ? .offline : .error,
                    icon: isOffline ? "wifi.slash" : "exclamationmark.triangle",
                    title: "Couldn't load projects",
                    message: FriendlyErrorMessage.from(loadError),
                    actionTitle: "Retry",
                    action: { projectStore.fetchProjectsIfNeeded(force: true) }
                )
            }
            ForEach(projectStore.projects) { project in
                Button(action: { selectProject(project.id) }) {
                    HStack {
                        if projectStore.selectedProjectId == project.id {
                            Image(systemName: "checkmark")
                        }
                        Text(project.title)
                    }
                }
            }
        } label: {
            menuRow(
                icon: "folder",
                iconColor: Theme.accentCowork,
                title: "Add to project",
                value: projectStore.selectedProject?.title ?? "None"
            )
        }
        .onAppear { projectStore.fetchProjectsIfNeeded() }
    }

    private func selectProject(_ id: String?) {
        hapticLight()
        projectStore.selectedProjectId = id
    }

    private var permissionsRow: some View {
        Menu {
            ForEach(CoworkPermission.allCases, id: \.self) { permission in
                Button(action: { agentModeStore.coworkPermission = permission }) {
                    HStack {
                        if agentModeStore.coworkPermission == permission {
                            Image(systemName: "checkmark")
                        }
                        Text(permission.label)
                    }
                }
            }
        } label: {
            menuRow(
                icon: "checkmark.shield",
                iconColor: Theme.statusWarning,
                title: "Permissions",
                value: agentModeStore.coworkPermission.label
            )
        }
    }

    private var coworkTasksRow: some View {
        Button(action: {
            hapticLight()
            isCoworkTasksPresented = true
        }) {
            menuRow(
                icon: "checklist",
                iconColor: Theme.accentCowork,
                title: "Cowork Tasks",
                value: ""
            )
        }
        .buttonStyle(.plain)
    }

    private var agentActivityRow: some View {
        Button(action: {
            hapticLight()
            isAgentActivityPresented = true
        }) {
            menuRow(
                icon: "bubble.left.and.bubble.right",
                iconColor: Theme.accentPrimary,
                title: "Agent Activity",
                value: ""
            )
        }
        .buttonStyle(.plain)
    }

    private func menuRow(icon: String, iconColor: Color, title: String, value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(iconColor)
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color("TextPrimary"))
            Spacer()
            Text(value)
                .font(.system(size: 13))
                .foregroundColor(Color("TextSecondary"))
                .lineLimit(1)
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(Color("TextSecondary"))
        }
        .frame(height: 44)
        .glassPanel()
    }

    // MARK: - Connectors / Form Surfaces / Brain capture

    private var connectorsRow: some View {
        Button(action: {
            hapticLight()
            isConnectorsPresented = true
        }) {
            HStack(spacing: 10) {
                Image(systemName: "puzzlepiece.extension")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Color("AccentPrimary"))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Connectors")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color("TextPrimary"))
                    Text("Browse and manage connected services")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color("TextSecondary"))
            }
        }
        .buttonStyle(.plain)
        .glassPanel()
    }

    @ViewBuilder
    private var brainCaptureRow: some View {
        if brainStore.hasBrain {
            Button(action: {
                hapticLight()
                isBrainCapturePresented = true
            }) {
                HStack(spacing: 10) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color("AccentPrimary"))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Capture to brain")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color("TextPrimary"))
                        Text(brainStore.pendingPush
                             ? "Waiting to sync — will retry automatically"
                             : "Save an idea or pain to your second brain")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                    }
                    Spacer()
                    Image(systemName: brainStore.pendingPush
                          ? "arrow.triangle.2.circlepath" : "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color("TextSecondary"))
                }
            }
            .buttonStyle(.plain)
            .glassPanel()
        }
    }

    // MARK: - Permission flows

    private func photosTapped() {
        openPickerAfterPriming = true
        if PHPhotoLibrary.authorizationStatus(for: .readWrite) == .notDetermined,
           !AppPermission.photos.hasPrimed {
            primingPermission = .photos
            return
        }
        requestPhotoAccess()
    }

    private func showRecentPhotosTapped() {
        hapticLight()
        openPickerAfterPriming = false
        if PHPhotoLibrary.authorizationStatus(for: .readWrite) == .notDetermined,
           !AppPermission.photos.hasPrimed {
            primingPermission = .photos
            return
        }
        requestPhotoAccess()
    }

    private func requestPhotoAccess() {
        guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .notDetermined else {
            loadRecentPhotos()
            if openPickerAfterPriming { isPhotosPickerPresented = true }
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
            Task { @MainActor in
                loadRecentPhotos()
                if openPickerAfterPriming { isPhotosPickerPresented = true }
            }
        }
    }

    private func cameraTapped() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            pickerError = "Camera isn't available on this device."
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .notDetermined:
            if !AppPermission.camera.hasPrimed {
                primingPermission = .camera
            } else {
                requestCameraAccess()
            }
        case .authorized:
            isCameraPresented = true
        default:
            pickerError = "Camera access is off. Enable it in Settings to take photos."
        }
    }

    private func requestCameraAccess() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            Task { @MainActor in
                if granted {
                    isCameraPresented = true
                } else {
                    pickerError = "Camera access is off. Enable it in Settings to take photos."
                }
            }
        }
    }

    private func handlePrimingContinue(_ permission: AppPermission) {
        switch permission {
        case .photos: requestPhotoAccess()
        case .camera: requestCameraAccess()
        case .microphone: break
        case .notifications: break
        }
    }

    // MARK: - Staging

    private func loadRecentPhotos() {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited else {
            recentAssets = []
            return
        }
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = 12
        let result = PHAsset.fetchAssets(with: .image, options: options)
        var assets: [PHAsset] = []
        result.enumerateObjects { asset, _, _ in assets.append(asset) }
        recentAssets = assets
    }

    private func stagePickedPhotos(_ items: [PhotosPickerItem]) {
        Task {
            for (index, item) in items.enumerated() {
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                let contentType = item.supportedContentTypes.first ?? .jpeg
                let mediaType = contentType.preferredMIMEType ?? "image/jpeg"
                let ext = contentType.preferredFilenameExtension ?? "jpg"
                attachmentStore.add(StagedAttachment(
                    thumbnail: UIImage(data: data),
                    data: data,
                    filename: "photo-\(index + 1).\(ext)",
                    mediaType: mediaType
                ))
            }
        }
    }

    private func stageRecentPhoto(_ asset: PHAsset) {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, dataUTI, _, _ in
            Task { @MainActor in
                guard let data else { return }
                let contentType = dataUTI.flatMap { UTType($0) } ?? .jpeg
                let mediaType = contentType.preferredMIMEType ?? "image/jpeg"
                let ext = contentType.preferredFilenameExtension ?? "jpg"
                attachmentStore.add(StagedAttachment(
                    thumbnail: UIImage(data: data),
                    data: data,
                    filename: "photo.\(ext)",
                    mediaType: mediaType
                ))
            }
        }
    }

    private func stageCameraImage(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        attachmentStore.add(StagedAttachment(
            thumbnail: image,
            data: data,
            filename: "camera.jpg",
            mediaType: "image/jpeg"
        ))
    }

    private func stageFile(_ url: URL) {
        guard let data = try? Data(contentsOf: url) else {
            pickerError = "Couldn't read that file."
            return
        }
        let mediaType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
            ?? "application/octet-stream"
        attachmentStore.add(StagedAttachment(
            thumbnail: nil,
            data: data,
            filename: url.lastPathComponent,
            mediaType: mediaType
        ))
    }

    private func hapticLight() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
}

// MARK: - Recent photo thumbnail

/// One thumbnail in the recents strip; requests its own image on appear.
private struct RecentPhotoThumb: View {
    let asset: PHAsset
    @State private var image: UIImage? = nil

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Color("BgSecondary")
            }
        }
        .frame(width: 72, height: 72)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusSM)
                .stroke(Theme.borderWarmSubtle, lineWidth: 1)
        )
        .task {
            let options = PHImageRequestOptions()
            options.deliveryMode = .opportunistic
            options.isNetworkAccessAllowed = true
            PHImageManager.default().requestImage(
                for: asset,
                targetSize: CGSize(width: 216, height: 216),
                contentMode: .aspectFill,
                options: options
            ) { result, _ in
                Task { @MainActor in
                    if let result { image = result }
                }
            }
        }
    }
}

// MARK: - Camera picker (UIImagePickerController wrapper)

/// SwiftUI has no camera API — the picker stays in UIKit. Picker callbacks
/// hop to the MainActor before staging.
private struct CameraPicker: UIViewControllerRepresentable {
    let onImage: @MainActor (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImage: @MainActor (UIImage) -> Void

        init(onImage: @escaping @MainActor (UIImage) -> Void) {
            self.onImage = onImage
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = info[.originalImage] as? UIImage
            picker.dismiss(animated: true)
            guard let image else { return }
            Task { @MainActor in onImage(image) }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

// MARK: - Document picker (UIDocumentPickerViewController wrapper)

/// Files source: any content type, copied into the app inbox on pick so the
/// data stays readable after the picker dismisses. Shared with the project
/// detail's "Add files" flow (ProjectDetailView).
struct DocumentPicker: UIViewControllerRepresentable {
    let onPick: @MainActor (URL) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: @MainActor (URL) -> Void

        init(onPick: @escaping @MainActor (URL) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            Task { @MainActor in onPick(url) }
        }
    }
}

fileprivate struct GlassPanel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .fill(Color("BgPanel").opacity(0.55))
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.radiusLG))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .stroke(Color("BorderSubtle").opacity(0.55), lineWidth: 1)
            )
    }
}

fileprivate extension View {
    func glassPanel() -> some View {
        modifier(GlassPanel())
    }
}
