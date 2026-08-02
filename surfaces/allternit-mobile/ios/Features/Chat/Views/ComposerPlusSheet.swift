import AVFoundation
import Photos
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The composer "+" button's sheet (Claude iOS "Add to Chat" parity): Camera /
/// Photos / Files sources, a recent-photos strip once photo access is granted,
/// "Add to project" selection, the Web search / Research tool toggles, the
/// Tool access mode, cowork Permissions, and the Connectors entry. Picks stage
/// into the shared `AttachmentStore` and render as the thumbnail strip above
/// the composer text field.
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
    /// Set to present the app-owned priming sheet before a system prompt.
    @State private var primingPermission: AppPermission? = nil
    /// Whether granting photo access from the priming sheet should also open
    /// the picker (Photos button) or just reveal the recents strip
    /// ("Show recent photos" row).
    @State private var openPickerAfterPriming = false
    /// Non-permission failures (camera unavailable, unreadable file).
    @State private var pickerError: String? = nil

    /// DEBUG: `-open-plus-sheet` pins the sheet to .large so screenshot
    /// verification can see every section (simctl can't scroll sheets).
    private static var sheetDetents: Set<PresentationDetent> {
        #if DEBUG
        if CommandLine.arguments.contains("-open-plus-sheet") { return [.large] }
        #endif
        return [.medium, .large]
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Add to Chat")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color("TextSecondary"))
                        .frame(width: 32, height: 32)
                        .background(Color("BgPanel"))
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)

            Divider().background(Color("BorderSubtle"))

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if let pickerError {
                        Text(pickerError)
                            .font(.caption)
                            .foregroundColor(Theme.statusWarning)
                    }

                    sourceRow
                    recentPhotosSection
                    projectRow
                    togglesSection
                    toolAccessSection
                    permissionsRow
                    coworkTasksRow
                    connectorsRow
                    brainCaptureRow
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
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

    // MARK: - Sources (Camera / Photos / Files)

    private var sourceRow: some View {
        HStack(spacing: 12) {
            sourceButton(icon: "camera", label: "Camera", action: cameraTapped)
            sourceButton(icon: "photo.on.rectangle", label: "Photos", action: photosTapped)
            sourceButton(icon: "folder", label: "Files", action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                isFilePickerPresented = true
            })
        }
    }

    private func sourceButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
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
    }

    // MARK: - Recent photos

    @ViewBuilder
    private var recentPhotosSection: some View {
        if recentAssets.isEmpty {
            // Access not granted yet (or an empty library): the row offers to
            // prime + request it, Claude's "Show recent photos" affordance.
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
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("Recent photos")
                    .font(.system(size: 13, weight: .semibold))
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
        }
    }

    // MARK: - Tool toggles

    private var togglesSection: some View {
        VStack(spacing: 2) {
            toolToggleRow(
                icon: "globe",
                title: "Web search",
                subtitle: "Let the agent search the web for current information",
                isOn: $toolOptions.webSearch
            )
            Divider().background(Color("BorderSubtle")).padding(.leading, 44)
            toolToggleRow(
                icon: "book",
                title: "Research",
                subtitle: "Deeper, multi-source research before answering",
                isOn: $toolOptions.research
            )
        }
        .padding(.vertical, 6)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
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
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    // MARK: - Tool access

    private var toolAccessSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Tool access")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))
            Picker("Tool access", selection: $toolOptions.toolAccess) {
                ForEach(ToolAccess.allCases, id: \.self) { access in
                    Text(access.label).tag(access)
                }
            }
            .pickerStyle(.segmented)
            Text(toolOptions.toolAccess.explainer)
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
        }
    }

    // MARK: - Project & permissions (moved off the composer — Claude's sheet layout)

    /// "Add to project" row — project selection lives here, not on the home
    /// screen (Claude's sheet shows the same row with the current value).
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
                Text("Loading projects…")
            } else if projectStore.loadError != nil, projectStore.projects.isEmpty {
                Button(action: { projectStore.fetchProjectsIfNeeded(force: true) }) {
                    Text("Couldn't load projects — tap to retry")
                }
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
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
        projectStore.selectedProjectId = id
    }

    /// Cowork permission level (was the top-deck "Ask before actions" pill).
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

    /// Cowork Tasks entry — same `menuRow` chrome as `permissionsRow`, but a
    /// plain Button (not a Menu) that presents `CoworkTasksListView` as its
    /// own sheet: this app has no dedicated Cowork screen to push onto, so
    /// the task list gets a sheet of its own rather than a Menu's inline
    /// options. `permissionsRow` has no visibility gating (always shown
    /// regardless of cowork/agent mode), so this row mirrors that — always
    /// visible — rather than inventing a new gating rule.
    private var coworkTasksRow: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
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

    /// Shared row chrome for Menu-backed rows: icon + title, trailing value
    /// + chevron (Claude's "Add to project — None ›" row).
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
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    // MARK: - Connectors

    private var connectorsRow: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
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
            .padding(.horizontal, 14)
            .frame(height: 56)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Brain capture (D3-R2)

    /// "Capture to brain" row — only when a brain exists (BrainStore.hasBrain);
    /// users who skipped onboarding creation never see it. Subtitle flips to a
    /// subtle pending-sync indicator while a push is queued.
    @ViewBuilder
    private var brainCaptureRow: some View {
        if brainStore.hasBrain {
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
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
                .padding(.horizontal, 14)
                .frame(height: 56)
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

    // MARK: - Permission flows

    /// Photos source: prime once (app-owned sheet before the iOS prompt),
    /// then request access and open the picker. The picker itself works
    /// out-of-process even when library access is denied, so it always opens;
    /// only the recents strip depends on the grant.
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
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
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

    /// Priming sheet's Continue: only now does the system prompt appear.
    private func handlePrimingContinue(_ permission: AppPermission) {
        switch permission {
        case .photos: requestPhotoAccess()
        case .camera: requestCameraAccess()
        case .microphone: break // the composer mic owns its priming continue
        case .notifications: break // the empty-chat card owns its priming continue
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
