import SwiftUI

/// Root of the `.browser` (ACI) tab — the view the integrator drops into
/// MainWorkspaceView's `.browser` branch.
///
/// One cohesive view with internal state, no navigation stack:
///   - `.landing` — search/URL bar with Google fallback, shortcut grid, and
///     the "Allternit Computer Agent" toggle (BrowserPane.tsx:268-271). With
///     the toggle ON the bar takes a goal and submitting starts an agent run;
///     OFF it opens the entered site in the in-app browser.
///   - `.browser(URL)` — ACIWebBrowserView (plain in-app browsing).
///   - `.agent(goal)` — ACIAgentRunView (computer-use run + live viewport).
struct ACITabView: View {
    @Binding var isSidebarOpen: Bool

    private let theme = ModeTheme(mode: .browser)

    private enum Destination {
        case landing
        case browser(URL)
        case agent(String)
    }

    @State private var destination: Destination
    @State private var input = ""
    /// Mirrors BrowserPane's agent toggle (`setAgentMode('Assist'|'Human')`).
    @State private var agentActive = false
    @FocusState private var inputFocused: Bool

    init(isSidebarOpen: Binding<Bool>) {
        self._isSidebarOpen = isSidebarOpen
        if CommandLine.arguments.contains("-extension") {
            self._destination = State(initialValue: .browser(URL(string: "https://news.ycombinator.com")!))
        } else {
            self._destination = State(initialValue: .landing)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if case .landing = destination {
                // Header Bar with hamburger menu
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

                    Text("ACI Browser")
                        .font(.system(.headline, design: .serif))
                        .fontWeight(.semibold)
                        .foregroundColor(theme.accent)

                    Spacer()

                    // Balancer spacer matching the hamburger button width
                    Spacer().frame(width: 44, height: 44)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 10)
                .background(Color("BgPrimary"))

                Divider().background(Color("BorderSubtle"))
            }

            Group {
                switch destination {
                case .landing:
                    landing
                case .browser(let url):
                    ACIWebBrowserView(initialURL: url, onExit: backToLanding, onStartAgentRun: { goal in
                        destination = .agent(goal)
                    })
                case .agent(let goal):
                    ACIAgentRunView(goal: goal, onExit: backToLanding)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color("BgSecondary"))
        }
    }

    private func backToLanding() {
        destination = .landing
    }

    // MARK: - Landing

    private var landing: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer(minLength: 24)

                // Mode glyph (ModePlaceholderView styling, kept for continuity).
                Image(systemName: theme.icon)
                    .font(.system(size: 28, weight: .medium))
                    .foregroundColor(theme.accent)
                    .frame(width: 64, height: 64)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusLG)
                            .stroke(theme.accentGlow, lineWidth: 1)
                    )

                searchBar
                    .frame(maxWidth: 560)

                agentToggle

                shortcutGrid
                    .frame(maxWidth: 560)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    /// URL/goal bar — port of the BrowserPane landing form
    /// (BrowserPane.tsx:249-266). Submit behavior depends on the agent
    /// toggle: goal for a run, or site/search for the browser.
    private var searchBar: some View {
        HStack(spacing: 8) {
            TextField(agentActive
                      ? "Describe a task for the Computer Agent…"
                      : "Search the web or enter a URL…",
                      text: $input)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(agentActive ? .default : .URL)
                .submitLabel(.go)
                .focused($inputFocused)
                .foregroundColor(Color("TextPrimary"))
                .font(.system(size: 16))
                .onSubmit(submit)

            Button(action: submit) {
                Image(systemName: agentActive ? "play.fill" : "magnifyingglass")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color("BgPrimary"))
                    .frame(width: 36, height: 36)
                    .background(theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
            }
            .buttonStyle(.plain)
            .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .frame(height: 56)
        .background(Color("BgPrimary"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(inputFocused ? theme.accent : Color("BorderSubtle"), lineWidth: 1)
        )
    }

    /// "Allternit Computer Agent: Active/Off" pill (BrowserPane.tsx:268-271).
    private var agentToggle: some View {
        Button(action: {
            agentActive.toggle()
            inputFocused = true
        }) {
            HStack(spacing: 6) {
                Image(systemName: "puzzlepiece.extension.fill")
                    .font(.system(size: 11))
                Text("Allternit Computer Agent: \(agentActive ? "Active" : "Off")")
                    .font(.system(size: 12))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .background(agentActive ? theme.accentSoft : Color("BgPrimary"))
            .foregroundColor(agentActive ? theme.accent : Color("TextSecondary"))
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(agentActive ? theme.accentGlow : Color("BorderSubtle"), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Shortcuts

    private struct Shortcut: Identifiable {
        let label: String
        let url: String
        var id: String { url }
    }

    /// The web's DEFAULT_SHORTCUTS (browserShortcuts.store.ts:25-29).
    private static let shortcuts: [Shortcut] = [
        Shortcut(label: "Google", url: "https://www.google.com"),
        Shortcut(label: "GitHub", url: "https://github.com"),
        Shortcut(label: "Hacker News", url: "https://news.ycombinator.com"),
    ]

    private var shortcutGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 12)], spacing: 12) {
            ForEach(Self.shortcuts) { shortcut in
                Button(action: {
                    if let url = URL(string: shortcut.url) {
                        destination = .browser(url)
                    }
                }) {
                    VStack(spacing: 8) {
                        favicon(for: shortcut.url)
                        Text(shortcut.label)
                            .font(.system(size: 12))
                            .foregroundColor(Color("TextSecondary"))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color("BgPrimary"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusMD)
                            .stroke(Color("BorderSubtle"), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Favicon via Google's service — the same helper the web uses
    /// (`getFaviconUrl`, browserShortcuts.store.ts:32-38); falls back to a
    /// globe glyph when the icon can't load.
    @ViewBuilder
    private func favicon(for siteURL: String) -> some View {
        let host = URL(string: siteURL)?.host ?? ""
        ZStack {
            Circle().fill(theme.accentSoft)
            AsyncImage(url: URL(string: "https://www.google.com/s2/favicons?domain=\(host)&sz=64")) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFit()
                } else {
                    Image(systemName: "globe")
                        .font(.system(size: 16))
                        .foregroundColor(Color("TextSecondary"))
                }
            }
            .frame(width: 28, height: 28)
        }
        .frame(width: 48, height: 48)
    }

    // MARK: - Submit

    private func submit() {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        inputFocused = false
        if agentActive {
            destination = .agent(value)
        } else {
            destination = .browser(ACIWebInput.resolve(value))
        }
        input = ""
    }
}
