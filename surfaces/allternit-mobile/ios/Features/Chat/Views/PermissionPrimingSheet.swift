import SwiftUI

/// App permissions that get an app-owned priming sheet BEFORE the iOS system
/// dialog (Claude iOS parity). Priming shows once per permission — the
/// UserDefaults flag flips on the first presentation, whichever button the
/// user taps; afterwards the system prompt (or its result) drives the flow.
enum AppPermission: String, Sendable, Identifiable, CaseIterable {
    case photos
    case camera
    case microphone
    case notifications

    /// For `.sheet(item:)` presentation of the priming sheet.
    var id: String { rawValue }

    private var primingShownKey: String { "allternit-priming-shown-\(rawValue)" }

    var hasPrimed: Bool { UserDefaults.standard.bool(forKey: primingShownKey) }
    func markPrimed() { UserDefaults.standard.set(true, forKey: primingShownKey) }

    /// `-reset-onboarding` (DEBUG): clears every priming flag so the
    /// first-run sheets show again.
    static func resetAllPriming() {
        for permission in allCases {
            UserDefaults.standard.removeObject(forKey: permission.primingShownKey)
        }
    }

    var icon: String {
        switch self {
        case .photos: return "photo.on.rectangle"
        case .camera: return "camera"
        case .microphone: return "mic"
        case .notifications: return "bell"
        }
    }

    var title: String {
        switch self {
        case .photos: return "Access your photos?"
        case .camera: return "Use your camera?"
        case .microphone: return "Dictate messages?"
        case .notifications: return "Get response notifications?"
        }
    }

    /// One-line why, shown under the title.
    var message: String {
        switch self {
        case .photos: return "Pick photos to attach to your chat, and see recent ones right in the composer."
        case .camera: return "Take a photo and attach it straight to your chat."
        case .microphone: return "Allternit transcribes what you say into the message field. Audio is only used while you dictate."
        case .notifications: return "Step away while Allternit works — we'll notify you when a response lands."
        }
    }
}

/// Reusable permission-priming sheet: mode-accent icon, one-line why,
/// Continue / Not Now. Only Continue proceeds to the system permission
/// request; either choice marks the permission primed (shows once).
struct PermissionPrimingSheet: View {
    let permission: AppPermission
    /// Called after Continue (the caller then requests the system permission).
    let onContinue: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: permission.icon)
                .font(.system(size: 28, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 72, height: 72)
                .background(Color("AccentPrimary").opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Color("AccentPrimary").opacity(0.28), lineWidth: 1)
                )

            VStack(spacing: 8) {
                Text(permission.title)
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))

                Text(permission.message)
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Spacer()

            VStack(spacing: 10) {
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    permission.markPrimed()
                    dismiss()
                    onContinue()
                }) {
                    Text("Continue")
                        .font(.system(.body, weight: .semibold))
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color("AccentPrimary"))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }

                Button(action: {
                    permission.markPrimed()
                    dismiss()
                }) {
                    Text("Not Now")
                        .font(.system(.body, weight: .medium))
                        .foregroundColor(Color("TextSecondary"))
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .presentationDetents([.height(380)])
    }
}
