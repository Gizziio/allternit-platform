import SwiftUI

/// A://Labs tab surface — mirrors the web's `LabsView`.
///
/// Phase 1: discovery hero, course tracks, and classroom lesson list backed by
/// `GET /api/v1/courses` and `GET /api/v1/lessons`. Research, certifications,
/// settings, and the lesson player are deferred.
struct LabsView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var labsStore = LabsStore.shared

    @State private var selectedTab: Tab = .discovery

    private enum Tab: String, CaseIterable {
        case discovery = "Discovery"
        case tracks = "Tracks"
        case classroom = "Classroom"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))
                tabBar
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            labsStore.fetchIfNeeded()
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

            Text("A://Labs")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    selectedTab = tab
                }) {
                    Text(tab.rawValue)
                        .font(.subheadline)
                        .fontWeight(selectedTab == tab ? .semibold : .regular)
                        .foregroundColor(selectedTab == tab ? Color("TextPrimary") : Color("TextSecondary"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .overlay(alignment: .bottom) {
                            if selectedTab == tab {
                                Rectangle()
                                    .fill(Color("AccentPrimary"))
                                    .frame(height: 2)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color("BgPrimary"))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if labsStore.isLoading && labsStore.courses.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = labsStore.loadError, labsStore.courses.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't load A://Labs")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    labsStore.fetchIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else {
            ScrollView {
                switch selectedTab {
                case .discovery:
                    discoveryContent
                case .tracks:
                    tracksContent
                case .classroom:
                    classroomContent
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable {
                await labsStore.refresh()
            }
        }
    }

    // MARK: - Discovery

    private var discoveryContent: some View {
        VStack(spacing: 20) {
            if let featured = labsStore.courses.first {
                featuredCard(featured)
            }

            if !labsStore.lessons.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Recent lessons")
                        .font(.headline)
                        .foregroundColor(Color("TextPrimary"))
                        .padding(.horizontal, 16)

                    LazyVStack(spacing: 8) {
                        ForEach(labsStore.lessons.prefix(5)) { lesson in
                            lessonRow(lesson)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .padding(.vertical, 16)
    }

    private func featuredCard(_ course: ALABSCourse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(labsGradient)
                        .frame(width: 48, height: 48)
                    Text(String(course.code.prefix(2)))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(course.code)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(labsAccent)
                        .textCase(.uppercase)
                    Text(course.title)
                        .font(.system(.title3, design: .serif))
                        .fontWeight(.medium)
                        .foregroundColor(Color("TextPrimary"))
                }

                Spacer()

                tierBadge(course.tier)
            }

            Text(course.description)
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .lineLimit(3)

            HStack(spacing: 12) {
                Label("\(course.modules) modules", systemImage: "rectangle.stack")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                Spacer()
                Text("Capstone: \(course.capstone)")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(1)
            }
        }
        .padding(18)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(labsAccent.opacity(0.25), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Tracks

    private var tracksContent: some View {
        LazyVStack(spacing: 12) {
            ForEach(labsStore.courses) { course in
                courseRow(course)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
    }

    private func courseRow(_ course: ALABSCourse) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(labsGradient)
                    .frame(width: 44, height: 44)
                Image(systemName: "graduationcap")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(course.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                Text(course.description)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
                HStack(spacing: 10) {
                    tierBadge(course.tier)
                    Text("\(course.modules) modules")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Color("TextSecondary"))
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    // MARK: - Classroom

    private var classroomContent: some View {
        LazyVStack(spacing: 20) {
            ForEach(labsStore.courses) { course in
                let courseLessons = labsStore.lessons(for: course.id)
                if !courseLessons.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(course.code)
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundColor(labsAccent)
                                .textCase(.uppercase)
                            Spacer()
                            Text("\(courseLessons.count) lessons")
                                .font(.caption)
                                .foregroundColor(Color("TextSecondary"))
                        }
                        .padding(.horizontal, 16)

                        LazyVStack(spacing: 8) {
                            ForEach(courseLessons) { lesson in
                                lessonRow(lesson)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
        .padding(.vertical, 16)
    }

    private func lessonRow(_ lesson: ALABSLesson) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color("BgSecondary"))
                    .frame(width: 32, height: 32)
                Text("\(lesson.moduleNumber).\(lesson.lessonNumber)")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(Color("TextPrimary"))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(1)
                Text(lesson.description)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
            }

            Spacer()

            if lesson.durationMinutes > 0 {
                Text("\(lesson.durationMinutes)m")
                    .font(.caption2)
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

    // MARK: - Helpers

    private var labsAccent: Color { Color(hex: "#a78bfa") }

    private var labsGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "#a78bfa"), Color(hex: "#7c3aed")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func tierBadge(_ tier: String) -> some View {
        Text(tier)
            .font(.caption2)
            .fontWeight(.bold)
            .tracking(0.03)
            .foregroundColor(labsAccent)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(labsAccent.opacity(0.12))
            .clipShape(Capsule())
    }
}
