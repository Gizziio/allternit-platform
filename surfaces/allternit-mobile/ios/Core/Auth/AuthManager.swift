import Foundation
import Combine
import ClerkKit

/// Thin wrapper over the official Clerk iOS SDK v1.3.x (ClerkKit / ClerkKitUI).
///
/// Dashboard prerequisites before this works against a real Clerk application:
/// 1. Enable the **Native API** (Clerk Dashboard → Native applications).
/// 2. Register this app's App ID Prefix + Bundle ID on that page.
/// 3. Add the Associated Domains capability to the target with
///    `webcredentials:{YOUR_FRONTEND_API_URL}` (required for seamless
///    OAuth / Apple Sign-In hand-off).
///
/// The publishable key comes from `AppConfig.clerkPublishableKey` (Info.plist).
/// While it is empty the SDK is deliberately left unconfigured and the login
/// gate shows a warning instead of crashing — accessing `Clerk.shared` before
/// `Clerk.configure` assertion-fails in debug builds.
@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    /// Whether `Clerk.configure` ran with a non-empty publishable key.
    @Published private(set) var isClerkConfigured = false
    @Published private(set) var isSignedIn = false
    @Published private(set) var currentSession: Session?

    /// Set true to present ClerkKitUI's `AuthView` sheet (see AllternitApp).
    @Published var isPresentingAuth = false

    private init() {}

    /// Configures the Clerk SDK. Call once at app start.
    func configure(publishableKey: String) {
        guard !publishableKey.isEmpty else {
            print("[AuthManager] CLERK_PUBLISHABLE_KEY is empty — Clerk SDK not configured.")
            return
        }
        Clerk.configure(publishableKey: publishableKey)
        isClerkConfigured = true
        refreshAuthState()
    }

    /// Mirrors `Clerk.shared.session` into the published gate state. Called
    /// after configure, sign-out, auth-sheet dismissal, and foregrounding.
    func refreshAuthState() {
        guard isClerkConfigured else { return }
        currentSession = Clerk.shared.session
        isSignedIn = currentSession != nil
    }

    /// Clerk session token for the API layer (the SDK caches and refreshes it).
    func getToken() async throws -> String? {
        guard isClerkConfigured else { return nil }
        return try await Clerk.shared.session?.getToken()
    }

    /// Bridges to ClerkKitUI: presenting the `AuthView` sheet is the sign-in flow.
    func signIn() {
        guard isClerkConfigured else { return }
        isPresentingAuth = true
    }

    func signOut() async throws {
        guard isClerkConfigured else { return }
        try await Clerk.shared.auth.signOut()
        refreshAuthState()
    }
}
