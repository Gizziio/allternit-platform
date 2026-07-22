import SwiftUI

/// One-time opt-in card at the TOP of an empty/new chat feed (Claude iOS
/// "Turn On Response Notifications" parity). Continue runs the app-owned
/// priming sheet (AppPermission.notifications) before the system dialog;
/// the X dismisses the card forever (the caller owns both flags).
struct ResponseNotificationsCard: View {
    let onContinue: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "bell.fill")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 36, height: 36)
                .background(Color("AccentPrimary").opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))

            VStack(alignment: .leading, spacing: 2) {
                Text("Turn On Response Notifications")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextPrimary"))
                Text("Step away — we'll notify you when Allternit responds.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                onContinue()
            }) {
                Text("Continue")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.black)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color("AccentPrimary"))
                    .clipShape(Capsule())
            }

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 28, height: 28)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }
}
