import SwiftUI

/// Code-mode Skills & Plugins sheet parity (web `SkillsView.tsx`).
///
/// A grid of team skill cards fetched from `GET /api/v1/team-skills`, with
/// loading, error, and empty states matching the Cowork task list sheet.
struct CodeSkillsView: View {
    @StateObject private var skillsStore = TeamSkillsStore.shared
    @Environment(\.dismiss) private var dismiss

    /// Heuristic matching web's `isPlugin`: source repo containing "mcp" or
    /// name containing "connector" renders as a plugin/connector card.
    private func isPlugin(_ skill: TeamSkill) -> Bool {
        (skill.sourceRepo ?? "").localizedCaseInsensitiveContains("mcp")
            || skill.name.localizedCaseInsensitiveContains("connector")
    }

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
        .task {
            skillsStore.fetchSkillsIfNeeded()
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Skills & Plugins")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Text("Manage your agent's capabilities.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            Spacer()

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                dismiss()
            }) {
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
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if skillsStore.isLoading && skillsStore.skills.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = skillsStore.loadError, skillsStore.skills.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't load skills")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    skillsStore.fetchSkillsIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else if skillsStore.skills.isEmpty {
            Spacer()
            emptyState
            Spacer()
        } else {
            listContent
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "puzzlepiece.extension")
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(Color("TextSecondary"))
                .frame(width: 56, height: 56)
                .background(Color("BgPanel"))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Theme.borderWarmDefault, lineWidth: 1)
                )
            Text("No skills installed yet")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    private var listContent: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(skillsStore.skills) { skill in
                    skillCard(skill)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
        }
        .refreshable {
            await skillsStore.refresh()
        }
    }

    private func skillCard(_ skill: TeamSkill) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Image(systemName: isPlugin(skill) ? "plugs.connected" : "cpu")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(isPlugin(skill) ? Theme.statusWarning : Color("AccentPrimary"))
                    .frame(width: 44, height: 44)
                    .background(Color("BgSecondary"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

                Spacer()

                Text("v\(skill.version)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextSecondary"))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color("BgSecondary"))
                    .clipShape(Capsule())
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(skill.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)

                Text(skill.description ?? "No description.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }

            HStack(spacing: 4) {
                Image(systemName: "terminal")
                    .font(.system(size: 11))
                    .foregroundColor(Color("TextSecondary"))
                Text("Commands")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextSecondary"))
            }
            .padding(.top, 4)
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }
}
