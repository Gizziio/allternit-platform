import SwiftUI
import ClerkKit
import ClerkKitUI

@main
struct AllternitApp: App {
    @StateObject private var authManager = AuthManager.shared
    /// Platform mode state (chat/cowork/code/browser) + composer agent
    /// state, available environment-wide so every surface reads the same
    /// mode accent and agent pill context.
    @StateObject private var modeStore = AppModeStore()
    @StateObject private var agentModeStore = AgentModeStore()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        AuthManager.shared.configure(publishableKey: AppConfig.clerkPublishableKey)
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isClerkConfigured {
                    gatedContent
                        // ClerkKitUI views (AuthView) read Clerk from the environment.
                        .environment(Clerk.shared)
                } else {
                    // Publishable key placeholder not filled in — LoginGateView
                    // shows the setup hint instead of crashing on Clerk.shared.
                    LoginGateView()
                }
            }
            .preferredColorScheme(.dark)
            .environmentObject(authManager)
            .sheet(isPresented: $authManager.isPresentingAuth, onDismiss: {
                authManager.refreshAuthState()
            }) {
                AuthView()
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    authManager.refreshAuthState()
                }
            }
        }
    }

    @ViewBuilder
    private var gatedContent: some View {
        if authManager.isSignedIn {
            MainWorkspaceView()
                .environmentObject(modeStore)
                .environmentObject(agentModeStore)
        } else {
            LoginGateView()
        }
    }
}

struct LoginGateView: View {
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Logo Accent matching Allternit's web logo
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("A://")
                    .foregroundColor(Color("AccentPrimary"))
                    .font(.system(.title2, design: .monospaced))
                    .bold()
                Text("LLTERNIT")
                    .foregroundColor(Color("TextPrimary"))
                    .font(.system(.title2, design: .serif))
                    .tracking(4.0)
            }

            Text("Your native workspace for autonomous AI execution.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer()

            if !auth.isClerkConfigured {
                Text("Set CLERK_PUBLISHABLE_KEY in Info.plist to enable sign-in.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            // Sign-in = presenting ClerkKitUI's AuthView sheet (see AuthManager.signIn).
            Button(action: auth.signIn) {
                Text("Sign In to Allternit")
                    .font(.headline)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color("AccentPrimary"))
                    .cornerRadius(12)
            }
            .disabled(!auth.isClerkConfigured)
            .opacity(auth.isClerkConfigured ? 1 : 0.5)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
    }
}
