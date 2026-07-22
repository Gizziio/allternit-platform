import SwiftUI

/// Work-profile options for the onboarding radio grid (Phase 10, ChatGPT
/// macOS onboarding parity — "Which best describes your work?"). The raw
/// value is the wire id sent as `metadata.persona` on session create; the
/// label is what the grid renders.
enum OnboardingPersona: String, CaseIterable, Sendable {
    case engineering
    case design
    case finance
    case legal
    case dataScience = "data-science"
    case marketing
    case operations
    case student
    case product
    case sales
    case peopleHR = "people-hr"
    case other

    var label: String {
        switch self {
        case .engineering: return "Engineering"
        case .design: return "Design"
        case .finance: return "Finance"
        case .legal: return "Legal"
        case .dataScience: return "Data science"
        case .marketing: return "Marketing"
        case .operations: return "Operations"
        case .student: return "Student"
        case .product: return "Product"
        case .sales: return "Sales"
        case .peopleHR: return "People & HR"
        case .other: return "Other"
        }
    }
}

/// First-launch onboarding state (Phase 10). Persisted app-wide
/// (UserDefaults), mirroring SettingsStore's pattern:
/// - `isComplete` gates the flow in AllternitApp (root swap before the
///   workspace); `-reset-onboarding` clears it via `reset()`.
/// - `persona` is the work-profile answer — sent as `metadata.persona` on
///   session create (SessionContext) and used to reorder the Phase-9 home
///   suggestion rows (EmptyChatStateView).
/// - `suggestTasks` is the "Suggest personalized tasks" checkbox; persisted
///   for the future backend-personalized suggestions consumer.
/// - `pendingPrompt` is IN-MEMORY ONLY: a starter-task card tap on the last
///   onboarding page stashes its prompt here; ChatContentView moves it into
///   the composer once (fill-not-send, like the suggestion rows).
@MainActor
final class OnboardingStore: ObservableObject {
    static let shared = OnboardingStore()

    /// Onboarding gate — true once the flow is finished or skipped.
    @Published var isComplete: Bool {
        didSet { defaults.set(isComplete, forKey: Keys.complete) }
    }
    /// Work-profile radio-grid selection (nil until answered).
    @Published var persona: OnboardingPersona? {
        didSet { defaults.set(persona?.rawValue, forKey: Keys.persona) }
    }
    /// "Suggest personalized tasks" checkbox (on by default).
    @Published var suggestTasks: Bool {
        didSet { defaults.set(suggestTasks, forKey: Keys.suggestTasks) }
    }
    /// Starter-task prompt waiting to be filled into the composer.
    @Published var pendingPrompt: String? = nil

    private let defaults: UserDefaults

    private enum Keys {
        static let complete = "allternit-onboarding-complete"
        static let persona = "allternit-onboarding-persona"
        static let suggestTasks = "allternit-onboarding-suggest-tasks"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.isComplete = defaults.bool(forKey: Keys.complete)
        self.persona = defaults.string(forKey: Keys.persona)
            .flatMap(OnboardingPersona.init(rawValue:))
        self.suggestTasks = defaults.object(forKey: Keys.suggestTasks) as? Bool ?? true
    }

    /// Marks the flow done (finish, Get Started, or "Go to app" skip).
    func complete() {
        isComplete = true
    }

    /// `-reset-onboarding` (DEBUG): clears every onboarding flag so the next
    /// launch lands on page 1 again (fresh-install behavior).
    func reset() {
        defaults.removeObject(forKey: Keys.complete)
        defaults.removeObject(forKey: Keys.persona)
        defaults.removeObject(forKey: Keys.suggestTasks)
        isComplete = false
        persona = nil
        suggestTasks = true
        pendingPrompt = nil
    }
}
