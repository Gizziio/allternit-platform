import SwiftUI

/// Udemy Catalog state: search results and curated course IDs.
///
/// Data source: `POST /api/v1/udemy/search` (udemy_routes.rs). Curated IDs are
/// persisted to UserDefaults like the web's `allternit-labs-curated-courses` key.
@MainActor
final class UdemyCatalogStore: ObservableObject {
    static let shared = UdemyCatalogStore()

    @Published private(set) var courses: [UdemyCourse] = []
    @Published private(set) var isLoading = false
    @Published private(set) var loadError: String? = nil
    @Published private(set) var resultCount: Int = 0
    @Published private(set) var curatedIds: Set<Int> = []

    private let client: UdemyClient
    private let defaults: UserDefaults
    private let curatedKey = "allternit-labs-curated-courses"

    init(client: UdemyClient = .shared, defaults: UserDefaults = .standard) {
        self.client = client
        self.defaults = defaults
        if let data = defaults.data(forKey: curatedKey),
           let ids = try? JSONDecoder().decode([Int].self, from: data) {
            self.curatedIds = Set(ids)
        }
    }

    // MARK: - Search

    func search(query: String, price: String = "free", level: String? = nil) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            courses = []
            resultCount = 0
            return
        }
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            let response = try await client.search(query: trimmed, price: price, level: level)
            courses = response.results
            resultCount = response.count
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Curated

    func isCurated(_ course: UdemyCourse) -> Bool {
        curatedIds.contains(course.id)
    }

    func toggleCurated(_ course: UdemyCourse) {
        if curatedIds.contains(course.id) {
            curatedIds.remove(course.id)
        } else {
            curatedIds.insert(course.id)
        }
        if let data = try? JSONEncoder().encode(Array(curatedIds)) {
            defaults.set(data, forKey: curatedKey)
        }
    }
}
