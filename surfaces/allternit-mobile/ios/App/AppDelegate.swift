import UIKit

/// Bridges the UIKit APNs registration callbacks into
/// `PushNotificationManager` for SwiftUI's `@UIApplicationDelegateAdaptor`
/// (`AllternitApp`). See `PushNotificationManager` for why this is
/// unverifiable end-to-end today (no signing team, no backend endpoint).
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.didRegister(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.didFailToRegister(error: error)
        }
    }
}
