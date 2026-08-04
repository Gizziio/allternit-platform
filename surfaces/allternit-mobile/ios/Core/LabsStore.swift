import SwiftUI

/// A://Labs state: courses and published lessons.
///
/// Data sources: `GET /api/v1/courses` and `GET /api/v1/lessons`.
/// On failure the store keeps an empty list and exposes `loadError` so views
/// render an error state instead of spinning forever (ProjectStore's convention).
@MainActor
final class LabsStore: ObservableObject {
    static let shared = LabsStore()

    @Published private(set) var courses: [ALABSCourse] = []
    @Published private(set) var lessons: [ALABSLesson] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil

    private let client: LabsClient
    private var fetchTask: Task<Void, Never>? = nil

    init(client: LabsClient = .shared) {
        self.client = client
    }

    // MARK: - Fetch

    /// Fetches courses and lessons once per launch unless forced; concurrent
    /// callers share the in-flight request (ProjectStore pattern).
    func fetchIfNeeded(force: Bool = false) {
        guard force || courses.isEmpty, fetchTask == nil else { return }
        isLoading = true
        loadError = nil
        fetchTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.isLoading = false
                self.fetchTask = nil
            }
            do {
                async let coursesTask = self.client.listCourses()
                async let lessonsTask = self.client.listLessons()
                self.courses = try await coursesTask
                self.lessons = try await lessonsTask
            } catch is CancellationError {
                // View went away mid-flight — keep current state.
            } catch {
                self.loadError = error.localizedDescription
            }
        }
    }

    /// Unconditional refresh (pull-to-refresh).
    func refresh() async {
        loadError = nil
        do {
            async let coursesTask = client.listCourses()
            async let lessonsTask = client.listLessons()
            courses = try await coursesTask
            lessons = try await lessonsTask
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Helpers

    func lessons(for courseId: String) -> [ALABSLesson] {
        lessons.filter { $0.courseId == courseId }
    }
}
