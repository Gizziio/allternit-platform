import SwiftUI

/// Task detail — pushed from `CoworkTasksListView`'s internal
/// `NavigationStack`. A task's model is much smaller than a project's
/// (`ProjectDetailView` is the heavier precedent, with files/chats
/// sections), so Phase 1 keeps this to a single scrollable section:
/// description, a status-changing Menu (matching ComposerPlusSheet's
/// `permissionsRow` Menu chrome, `menuRow(icon:iconColor:title:value:)`),
/// assignee, and Delete with confirmation.
struct CoworkTaskDetailView: View {
    let task: CoworkTask

    @StateObject private var tasksStore = CoworkTasksStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var actionError: String? = nil
    @State private var isDeleteConfirmPresented = false
    @State private var isUpdatingStatus = false

    /// The live store record (status changes land here); falls back to the
    /// value captured on push (ProjectDetailView's `liveProject` pattern).
    private var liveTask: CoworkTask {
        tasksStore.task(withId: task.id) ?? task
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
                statusRow
                assigneeSection
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .navigationTitle(liveTask.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(role: .destructive, action: { isDeleteConfirmPresented = true }) {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Theme.statusWarning)
                }
            }
        }
        .alert("Delete this task?", isPresented: $isDeleteConfirmPresented) {
            Button("Delete", role: .destructive) { deleteTask() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This can't be undone.")
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var descriptionSection: some View {
        if let description = liveTask.description, !description.isEmpty {
            Text(description)
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
        }
    }

    /// Status changer — same Menu chrome as ComposerPlusSheet's
    /// `permissionsRow`.
    private var statusRow: some View {
        Menu {
            ForEach(CoworkTaskStatus.allCases, id: \.self) { status in
                Button(action: { updateStatus(status) }) {
                    HStack {
                        if liveTask.status == status {
                            Image(systemName: "checkmark")
                        }
                        Text(status.label)
                    }
                }
            }
        } label: {
            menuRow(
                icon: "circle.dashed",
                iconColor: Theme.statusWarning,
                title: "Status",
                value: isUpdatingStatus ? "Updating…" : liveTask.status.label
            )
        }
        .disabled(isUpdatingStatus)
    }

    @ViewBuilder
    private var assigneeSection: some View {
        if let assigneeType = liveTask.assigneeType {
            HStack(spacing: 10) {
                Image(systemName: assigneeType == .agent ? "cpu" : "person")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Theme.accentCowork)
                Text(assigneeType == .agent ? "Agent" : "Human")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                if let assigneeName = liveTask.assigneeName {
                    Text(assigneeName)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
                Spacer()
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
    }

    /// Shared row chrome for Menu-backed rows (ComposerPlusSheet.menuRow).
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

    // MARK: - Actions

    private func updateStatus(_ status: CoworkTaskStatus) {
        guard status != liveTask.status else { return }
        isUpdatingStatus = true
        Task {
            do {
                try await tasksStore.updateStatus(id: task.id, status: status)
            } catch {
                actionError = "Couldn't update status: \(error.localizedDescription)"
            }
            isUpdatingStatus = false
        }
    }

    private func deleteTask() {
        Task {
            do {
                try await tasksStore.delete(id: task.id)
                dismiss()
            } catch {
                actionError = "Couldn't delete the task: \(error.localizedDescription)"
            }
        }
    }
}
