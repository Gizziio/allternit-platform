import UIKit

/// APNs push-token plumbing.
///
/// Two blockers keep this from being end-to-end live on an unsigned build:
/// 1. `project.yml` has `DEVELOPMENT_TEAM: ""` and no Push Notifications
///    capability/entitlement, so `registerForRemoteNotifications()` fails
///    on real devices until the app is provisioned.
/// 2. The gateway's `POST /api/v1/device-tokens` route must be deployed.
///    `PushTokenClient` already calls it; a missing route surfaces as a
///    stored registration error rather than a silent TODO.
///
/// The manager stores the token locally and retries registration whenever
/// the system hands us a fresh token, so the device auto-registers once
/// both blockers are cleared.
@MainActor
final class PushNotificationManager: NSObject {
    static let shared = PushNotificationManager()

    private static let deviceTokenDefaultsKey = "allternit-apns-device-token"
    private static let registrationErrorDefaultsKey = "allternit-apns-registration-error"

    private(set) var lastDeviceTokenHex: String? {
        get { UserDefaults.standard.string(forKey: Self.deviceTokenDefaultsKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.deviceTokenDefaultsKey) }
    }

    /// Last registration failure, persisted for DEBUG diagnostics. Cleared on
    /// a successful registration.
    private(set) var lastRegistrationError: String? {
        get { UserDefaults.standard.string(forKey: Self.registrationErrorDefaultsKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.registrationErrorDefaultsKey) }
    }

    private override init() {}

    /// Called after the user grants local-notification authorization
    /// (`NotificationService.requestAuthorization`) — same consent moment,
    /// no separate prompt.
    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    /// `AppDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`.
    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        lastDeviceTokenHex = hex
        Task {
            do {
                try await PushTokenClient.shared.register(token: hex)
                lastRegistrationError = nil
            } catch {
                lastRegistrationError = error.localizedDescription
            }
        }
    }

    /// `AppDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:)`.
    /// Expected on unsigned builds (no signing team / push capability) —
    /// left silent rather than surfacing an error the user can't act on.
    func didFailToRegister(error: Error) {
        lastRegistrationError = error.localizedDescription
    }
}
