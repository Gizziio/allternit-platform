import UIKit

/// Gap 3 (APNs push) — client-side half only, and unverifiable end-to-end
/// from this machine. Two independent blockers, checked directly rather
/// than assumed:
///
/// 1. **No backend endpoint.** Searched `allternit-api`, `allternit-cloud-api`,
///    and `gizzi-code` for any device-token registration route — there is
///    none. `runtime_devices` (the thing that sounds closest) is the
///    unrelated mesh-pairing registry (`RuntimeDevicesClient`), not APNs.
/// 2. **No signing.** `project.yml` has `DEVELOPMENT_TEAM: ""` and no Push
///    Notifications capability/entitlement is provisioned — this app has
///    never been signed for a real device (see `allternit-ios-app` notes).
///    `registerForRemoteNotifications()` will fail on every build until
///    both exist.
///
/// What's real here: requesting the system registration and capturing the
/// resulting device token is correct, compiler-verified plumbing that a
/// future signed build can use as-is. The token is only ever stored
/// locally — wiring the POST is a one-line addition once a backend route
/// exists (see the TODO at `didRegister(deviceToken:)`).
@MainActor
final class PushNotificationManager: NSObject {
    static let shared = PushNotificationManager()

    private static let deviceTokenDefaultsKey = "allternit-apns-device-token"

    private(set) var lastDeviceTokenHex: String? {
        get { UserDefaults.standard.string(forKey: Self.deviceTokenDefaultsKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.deviceTokenDefaultsKey) }
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
        // TODO(backend): POST `hex` to a device-token registration endpoint
        // once one exists. Nothing to wire up yet — see the type doc above.
    }

    /// `AppDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:)`.
    /// Expected on every build today (no signing team / push capability) —
    /// left silent rather than surfacing an error the user can't act on.
    func didFailToRegister(error: Error) {}
}
