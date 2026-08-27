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
    enum AuthEntryMode {
        case signIn
        case signUp
    }

    static let shared = AuthManager()

    /// Whether `Clerk.configure` ran with a non-empty publishable key.
    @Published private(set) var isClerkConfigured = false
    @Published private(set) var isSignedIn = false
    @Published private(set) var currentSession: Session?

    /// Set true to present ClerkKitUI's `AuthView` sheet (see AllternitApp).
    @Published var isPresentingAuth = false
    @Published private(set) var authEntryMode: AuthEntryMode = .signIn

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
    /// When the user is signed in, kick off runtime pairing in the background
    /// so API calls can upgrade from a short-lived Clerk JWT to a long-lived
    /// cloud-issued device token.
    func refreshAuthState() {
        guard isClerkConfigured else { return }
        currentSession = Clerk.shared.session
        let wasSignedIn = isSignedIn
        isSignedIn = currentSession != nil

        if isSignedIn, !wasSignedIn {
            Task {
                do {
                    _ = try await RuntimePairing.shared.ensurePaired()
                } catch {
                    print("[AuthManager] Runtime pairing failed: \(error.localizedDescription)")
                }
            }
        }
    }

    /// Clerk session token for the API layer (the SDK caches and refreshes it).
    func getToken() async throws -> String? {
        guard isClerkConfigured else { return nil }
        return try await Clerk.shared.session?.getToken()
    }

    /// Returns the runtime device token when paired and valid; otherwise falls
    /// back to the Clerk session token. This is what `APIClient` sends as the
    /// Bearer token, matching desktop's use of `allternit_runtime_…` credentials.
    func effectiveToken() async throws -> String? {
        if RuntimePairing.shared.isPaired {
            await RuntimePairing.shared.rotateIfNeeded()
        }
        if let token = RuntimePairing.shared.deviceToken() {
            return token
        }
        return try await getToken()
    }

    /// Bridges to ClerkKitUI: presenting the `AuthView` sheet is the sign-in flow.
    func signIn() {
        guard isClerkConfigured else { return }
        authEntryMode = .signIn
        isPresentingAuth = true
    }

    /// Opens Clerk's dedicated account-creation flow.
    func signUp() {
        guard isClerkConfigured else { return }
        authEntryMode = .signUp
        isPresentingAuth = true
    }

    func signOut() async throws {
        guard isClerkConfigured else { return }
        // Revoke the iOS runtime device credential before signing out of Clerk.
        // The revoke call needs the current device token, so it must run first.
        await RuntimePairing.shared.revoke()
        try await Clerk.shared.auth.signOut()
        refreshAuthState()
    }

    /// Signed-in user's first name for the Phase-10 onboarding welcome
    /// ("Hey, Joe!"); nil when signed out / skip-auth / no first name, so
    /// the caller falls back to "Hey there!".
    var firstName: String? {
        guard isClerkConfigured else { return nil }
        guard let firstName = Clerk.shared.user?.firstName,
              !firstName.isEmpty else { return nil }
        return firstName
    }

    /// Display name for the sidebar footer: first name, full name, or the
    /// primary email's local part — whichever resolves first.
    var displayName: String {
        guard isClerkConfigured, let user = Clerk.shared.user else { return "Guest" }
        if let firstName = user.firstName, !firstName.isEmpty {
            return firstName
        }
        if let email = user.emailAddresses.first?.emailAddress {
            return email.split(separator: "@").first.map(String.init) ?? email
        }
        return "Account"
    }

    /// Sidebar avatar initial — the first character of `displayName`,
    /// uppercased (matches the reference app's single-letter avatar).
    var avatarInitial: String {
        guard isClerkConfigured else { return "A" }
        return displayName.first.map { String($0).uppercased() } ?? "?"
    }

    /// The signed-in user's primary email address (Settings account row);
    /// nil when signed out or the account has no email.
    var primaryEmail: String? {
        guard isClerkConfigured else { return nil }
        return Clerk.shared.user?.emailAddresses.first?.emailAddress
    }
}
