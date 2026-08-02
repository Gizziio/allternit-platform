import SwiftUI

/// First-launch onboarding (Phase 10, ChatGPT macOS onboarding parity +
/// Track D phase D3 brain step): a five-page flow shown once after first
/// sign-in, gated by `OnboardingStore.isComplete` in AllternitApp (root
/// swap — never over LoginGateView).
///
///   1. Welcome — aurora background, A:// monogram with the
///      EmptyChatStateView glow, "Hey, <first name>!" (Clerk first name;
///      "Hey there!" fallback under skip-auth), tagline.
///   2. Work profile — "Which best describes your work?" 12-option radio
///      grid (3 columns) + "Suggest personalized tasks" checkbox (on by
///      default); Continue stays disabled until a selection.
///   3. Starter tasks — 2x2 card grid whose ORDER follows the persona
///      answer; a card tap finishes the flow AND stashes the prompt in
///      `OnboardingStore.pendingPrompt` (the composer fills it once).
///   4. Second brain (D3-R1) — one-tap "Create my brain" provisions the
///      hosted remote and clones the canonical structure on-device
///      (BrainStore.createBrain). Offered, never forced: "Skip for now"
///      advances without creating anything (no repo left behind).
///   5. "You're all set" — Get Started finishes the flow.
///
/// Pages 2-4 carry a "Skip" text button → "Skip setup?" confirmation
/// (Keep setting up / Go to app), ChatGPT's exact pattern.
///
/// DEBUG args (simctl has no tap injection):
/// - `-open-onboarding` — force-show the flow regardless of the complete
///   flag (handled in AllternitApp).
/// - `-onboarding-page 2|3|4|5` — jump to a page for screenshots.
/// - `-onboarding-persona Engineering` — pre-select a persona (raw value
///   or label) so page 2 renders its selection state.
/// - `-onboarding-skip-dialog` — open the skip confirmation on appear.
struct OnboardingView: View {
    @StateObject private var store = OnboardingStore.shared
    @StateObject private var brainStore = BrainStore.shared

    @State private var page = 1
    @State private var showSkipDialog = false
    @State private var logoGlowing = false
    /// Inline error on the brain page after a failed creation attempt.
    @State private var brainError: String? = nil
    #if DEBUG
    /// `-brain-create-auto` fires createBrain once (simctl has no tap
    /// injection — same harness pattern as the spike's `-brain-spike-auto`).
    @State private var brainAutoRan = false
    #endif

    private static let pageCount = 5

    /// The four starter-task prompts. The ORDER rendered on page 3 is
    /// persona-tailored (see `starterTaskOrder`); the set itself is fixed.
    private struct StarterTask: Identifiable {
        let id: String
        let icon: String
        let prompt: String
    }

    private static let starterTasks: [StarterTask] = [
        StarterTask(id: "code", icon: "chevron.left.forwardslash.chevron.right", prompt: "Review my code"),
        StarterTask(id: "plan", icon: "checklist", prompt: "Write a project plan"),
        StarterTask(id: "status", icon: "envelope", prompt: "Draft a status update"),
        StarterTask(id: "summarize", icon: "doc.text", prompt: "Summarize a document"),
    ]

    /// Persona → starter-task id order (static maps are fine — the cards
    /// are the same four, only the lead changes):
    /// - engineering leads with code review (spec example).
    /// - data/finance/legal/student lead with summarization.
    /// - marketing/sales lead with the drafting task.
    /// - product/operations/people-HR/design lead with planning.
    /// - nil/other use the default declaration order.
    private static let starterTaskOrder: [OnboardingPersona: [String]] = [
        .engineering: ["code", "plan", "status", "summarize"],
        .design: ["plan", "summarize", "status", "code"],
        .finance: ["summarize", "status", "plan", "code"],
        .legal: ["summarize", "status", "plan", "code"],
        .dataScience: ["summarize", "code", "plan", "status"],
        .marketing: ["status", "plan", "summarize", "code"],
        .operations: ["plan", "status", "summarize", "code"],
        .student: ["summarize", "plan", "code", "status"],
        .product: ["plan", "status", "summarize", "code"],
        .sales: ["status", "plan", "summarize", "code"],
        .peopleHR: ["plan", "status", "summarize", "code"],
        .other: ["plan", "summarize", "status", "code"],
    ]

    private var orderedStarterTasks: [StarterTask] {
        let order = store.persona.flatMap { Self.starterTaskOrder[$0] }
            ?? Self.starterTasks.map(\.id)
        return order.compactMap { id in Self.starterTasks.first { $0.id == id } }
    }

    /// "Hey, Joe!" — Clerk first name; "Hey there!" under skip-auth or
    /// when the account has no first name.
    private var welcomeTitle: String {
        if let firstName = AuthManager.shared.firstName {
            return "Hey, \(firstName)!"
        }
        return "Hey there!"
    }

    var body: some View {
        ZStack {
            Color("BgPrimary").edgesIgnoringSafeArea(.all)
            auroraBackground

            VStack(spacing: 0) {
                // Skip affordance (pages 2-4 only, ChatGPT's placement).
                HStack {
                    Spacer()
                    if page >= 2 && page <= 4 {
                        Button("Skip") { showSkipDialog = true }
                            .font(.subheadline)
                            .foregroundColor(Color("TextSecondary"))
                    }
                }
                .frame(height: 44)
                .padding(.horizontal, 20)

                ScrollView {
                    Group {
                        switch page {
                        case 1: welcomePage
                        case 2: workProfilePage
                        case 3: starterTasksPage
                        case 4: brainPage
                        default: allSetPage
                        }
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                    .id(page)
                }
                .scrollIndicators(.hidden)

                bottomControls
            }
        }
        .alert("Skip setup?", isPresented: $showSkipDialog) {
            Button("Keep setting up", role: .cancel) {}
            Button("Go to app") { store.complete() }
        } message: {
            Text("You'll go straight to the app.")
        }
        .onAppear {
            logoGlowing = true
            #if DEBUG
            if let raw = UserDefaults.standard.string(forKey: "onboarding-page"),
               let target = Int(raw), (1...Self.pageCount).contains(target) {
                page = target
            }
            if let raw = UserDefaults.standard.string(forKey: "onboarding-persona"),
               let persona = OnboardingPersona(rawValue: raw)
                ?? OnboardingPersona.allCases.first(where: { $0.label == raw }) {
                store.persona = persona
            }
            if CommandLine.arguments.contains("-onboarding-skip-dialog") {
                showSkipDialog = true
            }
            // `-brain-create-auto` (D3 live verification): run "Create my
            // brain" automatically and record the outcome to
            // <Documents>/brain-create-result.json for the simctl harness.
            if CommandLine.arguments.contains("-brain-create-auto"), !brainAutoRan {
                brainAutoRan = true
                Task {
                    do {
                        try await brainStore.createBrain()
                        writeBrainCreateResult(ok: true, error: nil)
                    } catch {
                        brainError = error.localizedDescription
                        writeBrainCreateResult(ok: false, error: error.localizedDescription)
                    }
                }
            }
            #endif
        }
    }

    #if DEBUG
    /// Result file for `-brain-create-auto` (read from the host via simctl —
    /// no screenshot parsing), mirroring the spike's brain-spike-result.json.
    private func writeBrainCreateResult(ok: Bool, error: String?) {
        let payload: [String: String] = [
            "ok": ok ? "true" : "false",
            "error": error ?? "",
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? data.write(to: docs.appendingPathComponent("brain-create-result.json"))
    }
    #endif

    // MARK: - Page 1: Welcome

    private var welcomePage: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 40)

            // A:// monogram with the ambient glow from EmptyChatStateView /
            // LoginGateView (accent circle, blurred, slow pulse).
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
            .padding(.bottom, 32)

            Text(welcomeTitle)
                .font(.system(size: 32, weight: .medium, design: .serif))
                .foregroundColor(Color("TextPrimary"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 12)

            Text("A few quick questions to tailor how Allternit works for you.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer(minLength: 40)
        }
    }

    // MARK: - Page 2: Work profile

    private var workProfilePage: some View {
        VStack(spacing: 0) {
            Text("Which best describes your work?")
                .font(.system(size: 24, weight: .medium, design: .serif))
                .foregroundColor(Color("TextPrimary"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 24)

            // 12-option radio grid (3 columns, single-select circles).
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                ForEach(OnboardingPersona.allCases, id: \.rawValue) { persona in
                    personaCell(persona)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)

            // "Suggest personalized tasks" checkbox (on by default).
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                store.suggestTasks.toggle()
            }) {
                HStack(spacing: 10) {
                    Image(systemName: store.suggestTasks ? "checkmark.square.fill" : "square")
                        .font(.system(size: 18))
                        .foregroundColor(store.suggestTasks ? Color("AccentPrimary") : Color("TextSecondary"))
                    Text("Suggest personalized tasks")
                        .font(.subheadline)
                        .foregroundColor(Color("TextPrimary"))
                    Spacer()
                }
                .padding(.horizontal, 24)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.bottom, 16)
        }
    }

    private func personaCell(_ persona: OnboardingPersona) -> some View {
        let isSelected = store.persona == persona
        return Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            store.persona = persona
        }) {
            VStack(spacing: 8) {
                // Single-select circle (radio, not checkbox).
                ZStack {
                    Circle()
                        .stroke(isSelected ? Color("AccentPrimary") : Color("BorderSubtle"), lineWidth: 1.5)
                        .frame(width: 20, height: 20)
                    if isSelected {
                        Circle()
                            .fill(Color("AccentPrimary"))
                            .frame(width: 10, height: 10)
                    }
                }
                Text(persona.label)
                    .font(.caption)
                    .foregroundColor(isSelected ? Color("TextPrimary") : Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? Color("AccentPrimary").opacity(0.10) : Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(isSelected ? Color("AccentPrimary").opacity(0.6) : Theme.borderWarmDefault, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Page 3: Starter tasks

    private var starterTasksPage: some View {
        VStack(spacing: 0) {
            Text("Try a starter task")
                .font(.system(size: 24, weight: .medium, design: .serif))
                .foregroundColor(Color("TextPrimary"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Tap one to jump in — we'll fill the composer for you.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
                .padding(.bottom, 24)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                ForEach(orderedStarterTasks) { task in
                    starterTaskCard(task)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func starterTaskCard(_ task: StarterTask) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            // Fill-not-send: the composer consumes this once so the user
            // reviews before sending (same contract as the suggestion rows).
            store.pendingPrompt = task.prompt
            store.complete()
        }) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: task.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(Color("AccentPrimary"))
                    .frame(width: 32, height: 32)
                    .background(Color("AccentPrimary").opacity(0.14))
                    .clipShape(Circle())
                Text(task.prompt)
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Page 4: Second brain (D3-R1)

    private var brainPage: some View {
        VStack(spacing: 0) {
            Text("Your second brain")
                .font(.system(size: 24, weight: .medium, design: .serif))
                .foregroundColor(Color("TextPrimary"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("A local-first git repo of your ideas and notes — synced to your hosted remote, and read by agents that work for you.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
                .padding(.bottom, 24)

            VStack(alignment: .leading, spacing: 14) {
                brainFeatureRow(
                    icon: "iphone",
                    text: "Local-first — capture works offline, every device has full history")
                brainFeatureRow(
                    icon: "arrow.triangle.2.circlepath",
                    text: "Syncs to your hosted remote in the background")
                brainFeatureRow(
                    icon: "brain.head.profile",
                    text: "Agents read it to work on your behalf")
            }
            .padding(14)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
            .padding(.horizontal, 20)

            if let brainError {
                Text(brainError)
                    .font(.caption)
                    .foregroundColor(Theme.statusWarning)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .padding(.top, 16)
            }
        }
    }

    private func brainFeatureRow(icon: String, text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 28)
            Text(text)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    // MARK: - Page 5: You're all set

    private var allSetPage: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 60)

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56, weight: .light))
                .foregroundColor(Color("AccentPrimary"))
                .padding(.bottom, 24)

            Text("You're all set")
                .font(.system(size: 32, weight: .medium, design: .serif))
                .foregroundColor(Color("TextPrimary"))
                .padding(.bottom, 12)

            Text("Your workspace is ready. You can change any of this later in Settings.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer(minLength: 60)
        }
    }

    // MARK: - Bottom controls (Continue / Get Started + page dots)

    private var bottomControls: some View {
        VStack(spacing: 16) {
            // Page indicator dots.
            HStack(spacing: 8) {
                ForEach(1...Self.pageCount, id: \.self) { index in
                    Circle()
                        .fill(index == page ? Color("AccentPrimary") : Color("BorderSubtle"))
                        .frame(width: 6, height: 6)
                }
            }

            switch page {
            case 1:
                primaryButton(title: "Continue") { advance(to: 2) }
            case 2:
                primaryButton(title: "Continue", disabled: store.persona == nil) { advance(to: 3) }
            case 3:
                primaryButton(title: "Continue") { advance(to: 4) }
            case 4:
                brainControls
            default:
                primaryButton(title: "Get Started") {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    store.complete()
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 32)
    }

    /// Brain page controls: "Create my brain" (spinner while provisioning,
    /// "Try again" after a failure) + an always-visible "Skip for now" —
    /// the brain is offered, never forced.
    private var brainControls: some View {
        VStack(spacing: 12) {
            Button(action: createBrainTapped) {
                Group {
                    if brainStore.isProvisioning {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(brainError == nil ? "Create my brain" : "Try again")
                    }
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color("AccentPrimary"))
                .cornerRadius(Theme.radiusMD)
            }
            .disabled(brainStore.isProvisioning)
            .opacity(brainStore.isProvisioning ? 0.7 : 1)

            Button("Skip for now") { advance(to: 5) }
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .disabled(brainStore.isProvisioning)
        }
    }

    private func primaryButton(title: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            Text(title)
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color("AccentPrimary"))
                .cornerRadius(Theme.radiusMD)
        }
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }

    /// One tap = provision + mint token + clone + seed + commit + push
    /// (BrainStore.createBrain). Success advances to the all-set page;
    /// failure keeps the user here with an inline error and Try again.
    private func createBrainTapped() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
        brainError = nil
        Task {
            do {
                try await brainStore.createBrain()
                advance(to: 5)
            } catch {
                brainError = error.localizedDescription
            }
        }
    }

    private func advance(to target: Int) {
        withAnimation(.easeOut(duration: 0.25)) {
            page = target
        }
    }

    /// Soft aurora wash behind the flow (ChatGPT's welcome treatment):
    /// two blurred accent-tinted blobs drifting over BgPrimary.
    private var auroraBackground: some View {
        ZStack {
            Circle()
                .fill(Color("AccentPrimary").opacity(0.16))
                .frame(width: 320, height: 320)
                .blur(radius: 90)
                .offset(x: -110, y: -280)
            Circle()
                .fill(Theme.accentCowork.opacity(0.12))
                .frame(width: 280, height: 280)
                .blur(radius: 90)
                .offset(x: 130, y: -180)
            Circle()
                .fill(Theme.accentBrowser.opacity(0.10))
                .frame(width: 260, height: 260)
                .blur(radius: 100)
                .offset(x: 60, y: 240)
        }
        .allowsHitTesting(false)
    }
}
