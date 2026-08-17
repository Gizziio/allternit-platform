import SwiftUI
import ClerkKit
import ClerkKitUI

@main
struct AllternitApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var authManager = AuthManager.shared
    /// Platform mode state (chat/cowork/code/browser) + composer agent
    /// state, available environment-wide so every surface reads the same
    /// mode accent and agent pill context.
    @StateObject private var modeStore = AppModeStore()
    @StateObject private var agentModeStore = AgentModeStore()
    /// First-launch onboarding gate (Phase 10) — `isComplete` flips drive
    /// the root swap from OnboardingView to the workspace.
    @StateObject private var onboardingStore = OnboardingStore.shared
    @Environment(\.scenePhase) private var scenePhase
    @State private var openedDocumentURL: URL?

    init() {
        AuthManager.shared.configure(publishableKey: AppConfig.clerkPublishableKey)
        // Must register before this initializer returns — BGTaskScheduler
        // requires the handler in place before app launch completes.
        BackgroundRefreshManager.register()
        #if DEBUG
        // `-reset-onboarding` (DEBUG only): also clears the Phase-10
        // onboarding gate (the ChatView site clears the dictation/priming
        // flags). Clearing here means THIS launch lands on page 1.
        if CommandLine.arguments.contains("-reset-onboarding") {
            OnboardingStore.shared.reset()
        }
        #endif
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
            .environmentObject(authManager)
            .sheet(isPresented: $authManager.isPresentingAuth, onDismiss: {
                authManager.refreshAuthState()
            }) {
                AuthView(
                    mode: authManager.authEntryMode == .signUp ? .signUp : .signIn
                )
                    .environment(Clerk.shared)
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    authManager.refreshAuthState()
                } else if newPhase == .background {
                    BackgroundRefreshManager.scheduleNextRefresh()
                }
            }
            .onOpenURL { url in
                openedDocumentURL = url
            }
            .sheet(isPresented: Binding(
                get: { openedDocumentURL != nil },
                set: { if !$0 { openedDocumentURL = nil } }
            )) {
                if let url = openedDocumentURL {
                    LocalDocumentView(fileURL: url)
                }
            }
        }
    }

    @ViewBuilder
    private var gatedContent: some View {
        if authManager.isSignedIn || Self.skipAuthForTesting {
            // Phase 10: first-launch onboarding runs BEFORE the workspace
            // (root swap — it never covers LoginGateView). Completing or
            // skipping flips `isComplete` and swaps in the workspace.
            if (!onboardingStore.isComplete && !Self.bypassOnboardingForTesting)
                || Self.forceOnboardingForTesting {
                OnboardingView()
            } else {
                MainWorkspaceView()
                    .environmentObject(modeStore)
                    .environmentObject(agentModeStore)
            }
        } else {
            LoginGateView()
        }
    }

    /// `-skip-auth` (DEBUG builds only): bypasses the Clerk gate to exercise
    /// the workspace UI without an account. API calls go out without a
    /// Bearer token, so backend-fed views show their error/empty states.
    private static var skipAuthForTesting: Bool {
        #if DEBUG
        CommandLine.arguments.contains("-skip-auth")
        #else
        false
        #endif
    }

    /// `-open-onboarding` (DEBUG builds only): force-show the Phase-10
    /// onboarding flow regardless of the complete flag, for screenshots.
    private static var forceOnboardingForTesting: Bool {
        #if DEBUG
        CommandLine.arguments.contains("-open-onboarding")
        #else
        false
        #endif
    }

    /// Workspace-targeting DEBUG args imply "past onboarding" — simctl has
    /// no tap injection, so without this the Phase-10 gate would swallow
    /// the regression args (`-autosend`, `-open-settings`, …) on a fresh
    /// install before they ever reach the workspace.
    private static var bypassOnboardingForTesting: Bool {
        #if DEBUG
        let args = CommandLine.arguments
        return args.contains("-autosend")
            || args.contains("-open-settings")
            || args.contains("-open-plus-sheet")
            || args.contains("-open-incognito")
            || args.contains("-enable-agent-mode")
            || args.contains("-open-agent-sheet")
            || args.contains("-open-agent-hub")
            || args.contains("-open-agent-detail")
            || args.contains("-open-avatar-editor")
            || args.contains("-open-new-workspace-file")
            || args.contains("-open-workspace-file")
            || args.contains("-open-voice-mode")
            || args.contains("-open-voice-settings")
            || args.contains("-open-code-thread")
            || args.contains("-open-code-thread-id")
            || args.contains("-open-settings-brain-spike")
            || args.contains("-brain-spike-auto")
        #else
        false
        #endif
    }
}

struct LoginGateView: View {
    @EnvironmentObject var auth: AuthManager

    @State private var logoGlowing = false

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Logo with ambient glow matching LaunchHeader
            ZStack {
                Circle()
                    .fill(Color("AccentPrimary").opacity(logoGlowing ? 0.12 : 0.04))
                    .frame(width: 140, height: 140)
                    .blur(radius: 35)
                    .animation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true), value: logoGlowing)

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

            VStack(spacing: 12) {
                Button(action: auth.signIn) {
                    Text("Sign In")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color("AccentPrimary"))
                        .cornerRadius(12)
                }

                Button(action: auth.signUp) {
                    Text("Create Account")
                        .font(.headline)
                        .foregroundColor(Color("AccentPrimary"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color("AccentPrimary"), lineWidth: 1)
                        )
                }
            }
            .disabled(!auth.isClerkConfigured)
            .opacity(auth.isClerkConfigured ? 1 : 0.5)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .onAppear { logoGlowing = true }
    }
}
