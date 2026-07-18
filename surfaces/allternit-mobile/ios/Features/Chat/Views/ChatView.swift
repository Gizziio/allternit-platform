import SwiftUI

// MARK: - Mode host shell

/// Top-level mode host: a per-mode content area plus the platform's bottom
/// mode bar — the 3-way [Home | Code | ACI] control from the web rail
/// (surfaces/ai.allternit.com/src/shell/ShellRail.tsx:542-593). Cowork is
/// NOT a bar destination; it's a composer-level toggle inside Home
/// (BottomDock.tsx ChatCoworkToggle).
struct MainWorkspaceView: View {
    @EnvironmentObject private var modeStore: AppModeStore
    @State private var isSidebarOpen = false
    @State private var dragOffset: CGFloat = 0
    @State private var selectedSessionId: String? = nil

    private let sidebarWidth: CGFloat = 280

    /// Drawer position from 0 (closed) to 1 (open), tracking live drags.
    private var sidebarProgress: CGFloat {
        let base = isSidebarOpen ? sidebarWidth : 0
        return min(max(base + dragOffset, 0), sidebarWidth) / sidebarWidth
    }

    /// Home hosts both chat and cowork (the composer toggle flips between
    /// them); code and ACI are separate surfaces.
    private var isHome: Bool {
        modeStore.mode == .chat || modeStore.mode == .cowork
    }

    var body: some View {
        ZStack {
            // Background color matching Allternit theme
            Color("BgPrimary")
                .edgesIgnoringSafeArea(.all)

            VStack(spacing: 0) {
                ZStack {
                    if isHome {
                        // Left Sidebar Drawer
                        HistorySidebarView(
                            selectedSessionId: $selectedSessionId,
                            isSidebarOpen: $isSidebarOpen
                        )

                        // Main Chat Workspace View
                        ChatView(
                            sessionId: selectedSessionId,
                            isSidebarOpen: $isSidebarOpen
                        )
                        .cornerRadius(16 * sidebarProgress)
                        .scaleEffect(1 - 0.07 * sidebarProgress)
                        .offset(x: sidebarProgress * sidebarWidth)
                        .shadow(color: Color.black.opacity(0.4 * sidebarProgress), radius: 10, x: -5, y: 0)
                        .animation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0), value: isSidebarOpen)
                        .gesture(drawerGesture)
                    } else {
                        ModePlaceholderView(mode: modeStore.mode)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                Divider().background(Color("BorderSubtle"))

                PlatformModeBar()
            }
        }
    }

    /// Drawer drag: swiping right from the left margin opens, dragging left
    /// on an open drawer closes. Home-only — code/ACI have no drawer.
    private var drawerGesture: some Gesture {
        DragGesture()
            .onChanged { gesture in
                if isSidebarOpen {
                    // Dragging left pushes the open drawer closed.
                    if gesture.translation.width < 0 {
                        dragOffset = gesture.translation.width
                    }
                } else if gesture.startLocation.x < 50 && gesture.translation.width > 0 {
                    // Swiping right from the left margin exposes the sidebar.
                    dragOffset = gesture.translation.width
                }
            }
            .onEnded { gesture in
                let base = isSidebarOpen ? sidebarWidth : 0
                let projected = base + gesture.predictedEndTranslation.width
                withAnimation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0)) {
                    isSidebarOpen = projected > sidebarWidth / 2
                    dragOffset = 0
                }
            }
    }
}

// MARK: - Bottom mode bar

/// The platform's primary mode control, restyled from the rail's segmented
/// control: a segmented pill where each item is icon-only until active, when
/// its label animates in (ModeSwitcher.tsx `segmented` variant, lines
/// 241-309). The active item is tinted with the current mode accent — Home
/// glows purple while cowork is on.
struct PlatformModeBar: View {
    @EnvironmentObject private var modeStore: AppModeStore

    var body: some View {
        HStack {
            Spacer()
            HStack(spacing: 2) {
                ForEach(ModeBarItem.allCases, id: \.self) { item in
                    ModeBarButton(item: item)
                }
            }
            .padding(3)
            .background(Theme.glassBgThick)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmSubtle, lineWidth: 1)
            )
            Spacer()
        }
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }
}

private struct ModeBarButton: View {
    let item: ModeBarItem

    @EnvironmentObject private var modeStore: AppModeStore

    private var isActive: Bool {
        ModeBarItem.activeItem(for: modeStore.mode) == item
    }

    var body: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            modeStore.selectBarItem(item)
        }) {
            HStack(spacing: 4) {
                Image(systemName: item.icon)
                    .font(.system(size: 14, weight: .semibold))
                if isActive {
                    Text(item.label)
                        .font(.system(size: 12, weight: .bold))
                        .fixedSize()
                        .transition(.opacity.combined(with: .move(edge: .leading)))
                }
            }
            .padding(.horizontal, isActive ? 12 : 10)
            .frame(height: 30)
            .background(isActive ? Color("BgPrimary") : Color.clear)
            .foregroundColor(isActive ? modeStore.mode.theme.accent : Color("TextSecondary"))
            .clipShape(RoundedRectangle(cornerRadius: 9))
            .shadow(color: isActive ? Color.black.opacity(0.3) : .clear, radius: 2, y: 1)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0), value: isActive)
    }
}

// MARK: - Mode placeholders (UX-4 fills these)

/// Intentional placeholder for surfaces not yet built on iOS — centered
/// mode icon + label, tinted with the mode accent.
struct ModePlaceholderView: View {
    let mode: AppMode

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: mode.theme.icon)
                .font(.system(size: 28, weight: .medium))
                .foregroundColor(mode.theme.accent)
                .frame(width: 64, height: 64)
                .background(mode.theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(mode.theme.accentGlow, lineWidth: 1)
                )

            Text("\(mode.label) mode — coming in UX-4")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Text("This surface isn't part of the iOS app yet.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color("BgSecondary"))
    }
}

// MARK: - Chat surface (Home)

struct ChatView: View {
    let sessionId: String?
    @Binding var isSidebarOpen: Bool

    @StateObject private var viewModel = ChatViewModel()
    @EnvironmentObject private var modeStore: AppModeStore
    @EnvironmentObject private var agentModeStore: AgentModeStore
    @State private var inputText: String = ""
    @State private var selectedModel: String = "Allternit-Sonnet"
    @State private var activeArtifact: ArtifactRecord? = nil
    @Environment(\.scenePhase) private var scenePhase

    /// The mode + agent state the NEXT session create should be stamped
    /// with. Composer-level controls only apply pre-session, so pushing
    /// this into the view model can never mutate a live session.
    private var sessionContext: SessionContext {
        let mode = modeStore.mode
        let agentOn = agentModeStore.isAgentEnabled(for: mode)
        return SessionContext(
            originSurface: mode.originSurface,
            sessionMode: agentModeStore.sessionMode(for: mode),
            agentId: agentOn ? agentModeStore.selectedAgentId(for: mode) : nil,
            agentName: agentOn ? agentModeStore.selectedAgent(for: mode)?.name : nil,
            agentModeId: agentOn ? agentModeStore.selectedTile(for: mode).rawValue : nil
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header Bar
            HStack {
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    isSidebarOpen.toggle()
                }) {
                    Image(systemName: "line.3.horizontal")
                        .font(.title3)
                        .foregroundColor(Color("TextPrimary"))
                        .frame(width: 44, height: 44)
                }

                Spacer()

                Button(action: {
                    viewModel.startNewSession()
                }) {
                    Image(systemName: "square.and.pencil")
                        .font(.title3)
                        .foregroundColor(Color("TextPrimary"))
                        .frame(width: 44, height: 44)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .background(Color("BgPrimary"))

            Divider().background(Color("BorderSubtle"))

            // Transient load/send failure banner (dismissible).
            if let transientError = viewModel.transientError {
                TransientErrorBanner(message: transientError, onDismiss: {
                    viewModel.transientError = nil
                })
                Divider().background(Color("BorderSubtle"))
            }

            // Conversation Scroll Area
            ScrollViewReader { scrollProxy in
                ScrollView {
                    LazyVStack(spacing: 20) {
                        if viewModel.messages.isEmpty {
                            EmptyChatStateView()
                                .padding(.top, 80)
                        } else {
                            ForEach(viewModel.messages) { message in
                                MessageRow(message: message, onArtifactTap: { artifact in
                                    activeArtifact = artifact
                                })
                                .id(message.id)
                            }
                        }
                    }
                    .padding(.vertical, 20)
                }
                .background(Color("BgSecondary"))
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: viewModel.messages.last) { _, _ in
                    // Fires on new messages AND on streamed content changes;
                    // the view model's ~50ms flush coalescing bounds the rate.
                    if let lastId = viewModel.messages.last?.id {
                        withAnimation {
                            scrollProxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }

            Divider().background(Color("BorderSubtle"))

            // Composer card + decks (top deck in cowork, bottom deck when
            // the agent pill is on).
            ComposerView(
                inputText: $inputText,
                selectedModel: $selectedModel,
                isStreaming: viewModel.isStreaming,
                isSendDisabled: viewModel.isCreatingSession,
                hasActiveSession: viewModel.currentSessionId != nil,
                onSend: {
                    viewModel.sendMessage(inputText)
                    inputText = ""
                },
                onStop: {
                    viewModel.stopStreaming()
                },
                onDictationError: { message in
                    viewModel.transientError = message
                }
            )
            .background(Color("BgPrimary"))
        }
        .sheet(item: $activeArtifact) { artifact in
            ArtifactDetailsView(artifact: artifact)
        }
        .onAppear {
            viewModel.sessionContext = sessionContext
            if let sessionId = sessionId {
                viewModel.loadSession(sessionId)
            }
        }
        .onChange(of: sessionContext) { _, newContext in
            // Mode / agent pill changed pre-session: the next create is
            // stamped with the new context.
            viewModel.sessionContext = newContext
        }
        .onChange(of: sessionId) { _, newSessionId in
            // Tapping a history item swaps the session under this view.
            if let newSessionId = newSessionId {
                viewModel.loadSession(newSessionId)
            } else {
                viewModel.startNewSession()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            viewModel.handleScenePhase(newPhase)
        }
        .onChange(of: viewModel.draftToRestore) { _, draft in
            // A send that never landed hands its text back so the user can
            // retry without retyping.
            guard let draft else { return }
            inputText = draft
            viewModel.draftToRestore = nil
        }
    }
}

// MARK: - Composer

/// Deck slide motion — matches the web's deck-rise / deck-fall keyframes:
/// 0.35s cubic-bezier(0.22, 1, 0.36, 1)
/// (surfaces/ai.allternit.com/tailwind.config.ts:89-116).
private enum DeckMotion {
    static let animation = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.35)
}

/// The platform composer: one card holding the editor and a toolbar row,
/// with the cowork top deck tucked behind its top edge and the agent-mode
/// bottom deck tucked behind its bottom edge (CoworkTopDeck.tsx:115-144,
/// ChatComposer.tsx:2549-2567). Toolbar order mirrors the web:
/// + attach, Chat/Cowork toggle (pre-session only), Agent pill + caret,
/// spacer, dictation mic, model selector, send/stop.
struct ComposerView: View {
    @Binding var inputText: String
    @Binding var selectedModel: String
    let isStreaming: Bool
    /// True while the first message's session is being created — blocks
    /// double-sends into the same unbacked draft.
    let isSendDisabled: Bool
    /// The Chat/Cowork toggle is pre-session only (web `showModeToggle`).
    let hasActiveSession: Bool
    let onSend: () -> Void
    let onStop: () -> Void
    /// Dictation failures (permissions, engine) bubble up to the feed banner.
    let onDictationError: (String) -> Void

    @EnvironmentObject private var modeStore: AppModeStore
    @EnvironmentObject private var agentModeStore: AgentModeStore
    @StateObject private var dictation = DictationController()
    /// View-side dictation session flag: set on mic tap, cleared once the
    /// controller reports recording ended (silence, end tap, or error).
    @State private var isDictating = false
    /// Text in the field when dictation began (plus a trailing space); live
    /// partials render as `dictationBase + transcript` so Speech's word
    /// corrections replace earlier words instead of appending.
    @State private var dictationBase = ""

    private var mode: AppMode { modeStore.mode }
    private var theme: ModeTheme { mode.theme }
    private var agentOn: Bool { agentModeStore.isAgentEnabled(for: mode) }

    private var canSend: Bool {
        !inputText.isEmpty && !isSendDisabled
    }

    var body: some View {
        VStack(spacing: 0) {
            // Cowork top deck — tray tucked behind the composer card's top
            // edge, sliding up from behind on appearance (deck-rise).
            if mode == .cowork {
                CoworkTopDeck()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            composerCard
                .zIndex(1)

            // Agent-mode bottom deck — tray tucked behind the card's bottom
            // edge, sliding down from behind (deck-fall).
            if agentOn {
                AgentModeBottomDeck()
                    .zIndex(0)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(DeckMotion.animation, value: mode)
        .animation(DeckMotion.animation, value: agentOn)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .onAppear {
            if agentOn { agentModeStore.fetchAgentsIfNeeded() }
        }
        .onChange(of: agentOn) { _, on in
            // The agent selector lists the registry on first use (the web
            // fetches when agent mode activates, ChatComposer.tsx:779-800).
            if on { agentModeStore.fetchAgentsIfNeeded() }
        }
        .onChange(of: dictation.transcript) { _, transcript in
            // Live partials replace the tail of the field; the base keeps
            // whatever the user typed before starting dictation.
            guard isDictating else { return }
            inputText = dictationBase + transcript
        }
        .onChange(of: dictation.isRecording) { _, isRecording in
            // Session over (silence timeout or error): fold the final
            // transcript in once, then detach.
            guard !isRecording, isDictating else { return }
            inputText = dictationBase + dictation.transcript
            isDictating = false
        }
        .onChange(of: dictation.errorMessage) { _, errorMessage in
            guard let errorMessage else { return }
            isDictating = false
            onDictationError(errorMessage)
        }
    }

    // MARK: Composer card

    private var composerCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Text Input wrapping autogrowing editor
            TextField("Message Allternit...", text: $inputText, axis: .vertical)
                .lineLimit(1...6)
                .foregroundColor(Color("TextPrimary"))
                .font(.body)
                .padding(.horizontal, 6)
                .padding(.top, 2)

            // Toolbar row (web order: +, toggle, agent pill, …, mic, model, send)
            HStack(spacing: 6) {
                Button(action: { /* Open attachment sheet */ }) {
                    Image(systemName: "plus")
                        .font(.subheadline)
                        .foregroundColor(Color("TextSecondary"))
                        .frame(width: 36, height: 36)
                }

                if !hasActiveSession {
                    ChatCoworkToggle()
                }

                AgentPill()

                Spacer(minLength: 2)

                // Dictation mic: red + pulsing while recording.
                Button(action: toggleDictation) {
                    Image(systemName: dictation.isRecording ? "mic.fill" : "mic")
                        .symbolEffect(.pulse, isActive: dictation.isRecording)
                        .foregroundColor(dictation.isRecording ? .white : Color("TextSecondary"))
                        .frame(width: 40, height: 40)
                        .background(dictation.isRecording ? Color.red : Color("BgSecondary"))
                        .clipShape(Circle())
                }

                // Model Selector Menu
                Menu {
                    Button("Allternit-Sonnet", action: { selectedModel = "Allternit-Sonnet" })
                    Button("Allternit-Coworker", action: { selectedModel = "Allternit-Coworker" })
                    Button("Allternit-CodeFast", action: { selectedModel = "Allternit-CodeFast" })
                } label: {
                    HStack(spacing: 3) {
                        Text(selectedModel)
                            .font(.system(size: 11, weight: .medium))
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .layoutPriority(-1)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .bold))
                    }
                    .foregroundColor(Color("TextSecondary"))
                    .frame(height: 32)
                    .frame(maxWidth: 84)
                }

                if isStreaming {
                    Button(action: onStop) {
                        Image(systemName: "stop.fill")
                            .foregroundColor(.black)
                            .frame(width: 40, height: 40)
                            .background(Color("AccentPrimary"))
                            .clipShape(Circle())
                    }
                } else {
                    Button(action: sendTapped) {
                        Image(systemName: "arrow.up")
                            .foregroundColor(.black)
                            .frame(width: 40, height: 40)
                            .background(canSend ? Color("AccentPrimary") : Color("TextSecondary").opacity(0.3))
                            .clipShape(Circle())
                    }
                    .disabled(!canSend)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(agentOn ? theme.accentGlow : Theme.borderWarmDefault, lineWidth: 1)
        )
        // Agent-on glow: accent border above + a soft halo shadow
        // (web: box-shadow 0 0 10px <glow>, BottomDock.tsx:194-207).
        .shadow(color: agentOn ? theme.accentGlow : .clear, radius: 5)
    }

    private func toggleDictation() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        if dictation.isRecording {
            dictation.stop()
            // isDictating is cleared by the isRecording onChange, which
            // folds the final transcript into the field.
        } else {
            var base = inputText
            if !base.isEmpty, !base.hasSuffix(" ") {
                base += " "
            }
            dictationBase = base
            isDictating = true
            Task { await dictation.start() }
        }
    }

    private func sendTapped() {
        // Sending ends any live dictation: fold the latest transcript in
        // first so nothing the user said is lost.
        if isDictating {
            dictation.stop()
            inputText = dictationBase + dictation.transcript
            isDictating = false
        }
        onSend()
    }
}

// MARK: - Chat / Cowork toggle

/// 28pt segmented pair [Chat | Cowork] (BottomDock.tsx ChatCoworkToggle,
/// lines 18-63). Cowork is a composer-level mode, not a tab: selecting it
/// sets the app mode (accent turns purple, the top deck appears); selecting
/// Chat returns. Pre-session only — the caller hides it once a session is
/// active.
struct ChatCoworkToggle: View {
    @EnvironmentObject private var modeStore: AppModeStore

    var body: some View {
        HStack(spacing: 0) {
            segment(mode: .chat, icon: "message", label: "Chat")
            Rectangle()
                .fill(Theme.borderWarmDefault)
                .frame(width: 1, height: 16)
            segment(mode: .cowork, icon: "person.3", label: "Cowork")
        }
        .frame(height: 28)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(
            RoundedRectangle(cornerRadius: 7)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private func segment(mode: AppMode, icon: String, label: String) -> some View {
        let isActive = modeStore.mode == mode
        return Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            modeStore.mode = mode
        }) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
            }
            // Active = soft bg + mode accent text (web bg-composer-soft +
            // text-primary); inactive = muted.
            .foregroundColor(isActive ? mode.theme.accent : Color("TextSecondary"))
            .padding(.horizontal, 8)
            .frame(height: 28)
            .background(isActive ? mode.theme.accentSoft : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Agent pill

/// Agent On/Off pill + caret (BottomDock.tsx AgentModePill, lines 75-144).
/// Off: muted, bordered, "Agent Off". On: mode-accent border + soft bg +
/// glow, label "Agent | <tile>", and a caret that opens the agent selector.
/// State persists per mode (AgentModeStore).
struct AgentPill: View {
    @EnvironmentObject private var modeStore: AppModeStore
    @EnvironmentObject private var agentModeStore: AgentModeStore

    private var mode: AppMode { modeStore.mode }
    private var theme: ModeTheme { mode.theme }
    private var agentOn: Bool { agentModeStore.isAgentEnabled(for: mode) }

    /// Web label logic (BottomDock.tsx:90-98): the selected tile's label
    /// wins, then the agent name, then plain "Agent On". A tile always
    /// resolves (it defaults to the first visible one), so agent-on always
    /// reads "Agent | <tile>".
    private var label: String {
        guard agentOn else { return "Agent Off" }
        return "Agent | \(agentModeStore.selectedTile(for: mode).label)"
    }

    var body: some View {
        HStack(spacing: 0) {
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
                agentModeStore.toggleAgent(for: mode)
            }) {
                HStack(spacing: 6) {
                    // Phosphor Robot stand-in — SF Symbols has no robot glyph.
                    Image(systemName: "cpu")
                        .font(.system(size: 12, weight: .semibold))
                    Text(label)
                        .font(.system(size: 12, weight: .bold))
                        .lineLimit(1)
                }
                .foregroundColor(agentOn ? theme.accent : Color("TextSecondary"))
                .padding(.leading, 10)
                .padding(.trailing, agentOn ? 4 : 10)
                .frame(height: 32)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if agentOn {
                Rectangle()
                    .fill(theme.accentGlow)
                    .frame(width: 1, height: 16)

                Menu {
                    agentMenuContent
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(theme.accent)
                        .frame(width: 24, height: 24)
                        .contentShape(Rectangle())
                }
                .padding(.trailing, 4)
            }
        }
        .frame(height: 32)
        .background(agentOn ? theme.accentSoft : Color.clear)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(agentOn ? theme.accentGlow : Theme.borderWarmDefault, lineWidth: 1)
        )
        .shadow(color: agentOn ? theme.accentGlow : .clear, radius: 5)
        .opacity(agentOn ? 1 : 0.75)
    }

    /// Agent selector menu — the registry list behind the web's
    /// AgentSelectorDropdown (GET /api/v1/agents), filtered to the current
    /// surface, plus a "Default Agent" clear option (nil = the backend binds
    /// its default agent).
    @ViewBuilder
    private var agentMenuContent: some View {
        Button(action: { agentModeStore.selectAgent(nil, for: mode) }) {
            HStack {
                if agentModeStore.selectedAgentId(for: mode) == nil {
                    Image(systemName: "checkmark")
                }
                Text("Default Agent")
            }
        }

        if agentModeStore.isLoadingAgents {
            Text("Loading agents…")
        } else if agentModeStore.agentsError != nil {
            Button(action: { agentModeStore.fetchAgentsIfNeeded(force: true) }) {
                Text("Couldn't load agents — tap to retry")
            }
        }

        ForEach(agentModeStore.agentsForSurface(mode)) { agent in
            Button(action: { agentModeStore.selectAgent(agent, for: mode) }) {
                HStack {
                    if agentModeStore.selectedAgentId(for: mode) == agent.id {
                        Image(systemName: "checkmark")
                    }
                    Text(agent.name)
                }
            }
        }
    }
}

// MARK: - Cowork top deck

/// Cowork-only tray tucked behind the composer card's top edge
/// (CoworkTopDeck.tsx:115-144): 56pt total, 12pt hidden under the card via
/// negative padding + z-order, rounded top corners, same bg/border as the
/// composer card. Holds the Project and Permissions dropdowns.
struct CoworkTopDeck: View {
    @EnvironmentObject private var agentModeStore: AgentModeStore

    var body: some View {
        HStack(spacing: 12) {
            projectMenu
            permissionsMenu
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12) // tucked portion hidden under the card
        .frame(height: 56)
        .background(Color("BgPanel"))
        .clipShape(
            UnevenRoundedRectangle(topLeadingRadius: Theme.radiusLG, topTrailingRadius: Theme.radiusLG)
        )
        .overlay(
            UnevenRoundedRectangle(topLeadingRadius: Theme.radiusLG, topTrailingRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
        .padding(.bottom, -12) // -mb-3: the card overlaps the deck's bottom
        .zIndex(0)
    }

    /// Project dropdown. The web sources projects from CoworkStore; the
    /// mobile app has no projects endpoint wired yet, so the only entry is
    /// "No project" and the value stays "Select project" (web's none state).
    private var projectMenu: some View {
        Menu {
            Button(action: { agentModeStore.selectedProjectId = nil }) {
                HStack {
                    if agentModeStore.selectedProjectId == nil {
                        Image(systemName: "checkmark")
                    }
                    Text("No project")
                }
            }
        } label: {
            TopDeckPillLabel(
                icon: "folder",
                iconColor: Theme.accentCowork,
                text: "Select project"
            )
        }
    }

    /// Permissions dropdown (ShieldCheck): Auto-approve / Ask before actions
    /// (default) / Read-only. Persisted via AgentModeStore.
    private var permissionsMenu: some View {
        Menu {
            ForEach(CoworkPermission.allCases, id: \.self) { permission in
                Button(action: { agentModeStore.coworkPermission = permission }) {
                    HStack {
                        if agentModeStore.coworkPermission == permission {
                            Image(systemName: "checkmark")
                        }
                        Text(permission.label)
                    }
                }
            }
        } label: {
            TopDeckPillLabel(
                icon: "checkmark.shield",
                iconColor: Theme.statusWarning,
                text: agentModeStore.coworkPermission.label
            )
        }
    }
}

/// Pill label for top-deck dropdowns: 28pt capsule, soft bg + border,
/// icon + value + caret (CoworkTopDeck.tsx TopDeckDropdown, lines 43-56).
private struct TopDeckPillLabel: View {
    let icon: String
    let iconColor: Color
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(iconColor)
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color("TextPrimary"))
                .lineLimit(1)
                .frame(maxWidth: 120)
            Image(systemName: "chevron.down")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(Color("TextSecondary"))
        }
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(Color("BgPrimary").opacity(0.6))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }
}

// MARK: - Agent-mode bottom deck

/// Agent-on tray tucked behind the composer card's bottom edge
/// (ChatComposer.tsx:2549-2567): 60pt total, 12pt hidden under the card,
/// rounded bottom corners. Holds a horizontal scrolling row of agent-mode
/// tiles with per-tile colors (ModeDock.tsx MODE_TABS), filtered to the
/// current surface's set (SURFACE_MODES).
struct AgentModeBottomDeck: View {
    @EnvironmentObject private var modeStore: AppModeStore
    @EnvironmentObject private var agentModeStore: AgentModeStore

    private var surface: AppMode { modeStore.mode }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AgentModeTile.visibleTiles(for: surface), id: \.self) { tile in
                    tileButton(tile)
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.top, 12) // tucked portion hidden under the card
        .frame(height: 60)
        .background(Color("BgPanel"))
        .clipShape(
            UnevenRoundedRectangle(bottomLeadingRadius: Theme.radiusLG, bottomTrailingRadius: Theme.radiusLG)
        )
        .overlay(
            UnevenRoundedRectangle(bottomLeadingRadius: Theme.radiusLG, bottomTrailingRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
        .padding(.top, -12) // -mt-3: the card overlaps the deck's top
        .zIndex(0)
    }

    private func tileButton(_ tile: AgentModeTile) -> some View {
        let isSelected = agentModeStore.selectedTile(for: surface) == tile
        return Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            agentModeStore.selectTile(tile, for: surface)
        }) {
            HStack(spacing: 6) {
                Image(systemName: tile.icon)
                    .font(.system(size: 12, weight: .semibold))
                Text(tile.label)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundColor(isSelected ? tile.color : Color("TextSecondary"))
            .padding(.horizontal, 10)
            .frame(height: 32)
            .background(isSelected ? tile.color.opacity(0.15) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .stroke(isSelected ? tile.color.opacity(0.5) : Theme.borderWarmSubtle, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Empty state & banners

struct EmptyChatStateView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("A://")
                .foregroundColor(Color("AccentPrimary"))
                .font(.system(size: 40, weight: .bold, design: .monospaced))

            Text("How can Allternit assist you today?")
                .font(.system(.title3, design: .serif))
                .foregroundColor(Color("TextPrimary"))
                .fontWeight(.medium)

            Text("Start a thread, execute tasks, or inspect workspace artifacts locally.")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }
}

/// Dismissible one-line banner for transient load/send failures
/// (ChatViewModel.transientError), pinned to the top of the feed.
struct TransientErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.subheadline)
                .foregroundColor(.red)

            Text(message)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .lineLimit(2)

            Spacer(minLength: 8)

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 28, height: 28)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color("BgSecondary"))
    }
}
