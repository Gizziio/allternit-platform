import SwiftUI
import WebKit

/// Resolves free-form bar input to a URL — direct port of the web landing's
/// submit logic (surfaces/ai.allternit.com/src/shell/BrowserPane.tsx:254-258):
/// explicit `http(s)://` stays as-is; a dot without spaces is treated as a
/// host (`https://` prepended); anything else falls back to a Google search.
enum ACIWebInput {
    static func resolve(_ raw: String) -> URL {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let lowered = value.lowercased()

        if lowered.hasPrefix("http://") || lowered.hasPrefix("https://"),
           let url = URL(string: value) {
            return url
        }
        if value.contains("."), !value.contains(" "),
           let url = URL(string: "https://\(value)") {
            return url
        }
        // Google fallback (same query URL the web builds).
        var components = URLComponents(string: "https://www.google.com/search")!
        components.queryItems = [URLQueryItem(name: "q", value: value)]
        return components.url!
    }
}

/// Snapshot of the web view's navigation state, pushed by the coordinator on
/// every delegate callback and rendered by the bar/controls.
struct ACINavigationState: Equatable, Sendable {
    var url: URL? = nil
    var canGoBack = false
    var canGoForward = false
    var isLoading = false
    /// 0-1 load progress. Delegate-driven (start/commit/finish milestones) —
    /// no KVO, so no cross-thread observation to annotate under Swift 6.
    var progress: Double = 0
}

/// Imperative bridge between the SwiftUI chrome (URL bar, toolbar) and the
/// `WKWebView` inside the representable. The artifact webview loads static
/// content from `updateUIView`; a real browser needs user-triggered actions
/// (back/forward/reload/load-new-URL), which don't map onto SwiftUI's
/// update pass — so they go through this @MainActor controller instead.
@MainActor
final class ACIBrowserController: ObservableObject {
    @Published private(set) var navigation = ACINavigationState()

    /// Set by the representable in `makeUIView`; weak so the controller can
    /// outlive a torn-down web view without holding it.
    fileprivate weak var webView: WKWebView?

    private var loadedInitialURL = false

    func loadIfNeeded(_ url: URL) {
        guard !loadedInitialURL else { return }
        loadedInitialURL = true
        load(url)
    }

    func load(_ url: URL) {
        webView?.load(URLRequest(url: url))
    }

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
    func reload() { webView?.reload() }

    /// Called by the navigation delegate (main actor) on every milestone.
    func update(_ mutate: (inout ACINavigationState) -> Void) {
        mutate(&navigation)
    }
}

/// In-app web browser for the ACI tab — plain browsing, full navigation
/// allowed (this is NOT the locked-down artifact sandbox). URL bar on top,
/// progress bar under it, back/forward/reload toolbar at the bottom.
/// Keyboard-safe: nothing ignores the keyboard safe area, so SwiftUI's
/// default avoidance lifts the toolbar and shrinks the web view.
struct ACIWebBrowserView: View {
    let initialURL: URL
    let onExit: () -> Void

    @StateObject private var controller = ACIBrowserController()
    @State private var urlText = ""
    @FocusState private var urlFieldFocused: Bool

    private let theme = ModeTheme(mode: .browser)

    var body: some View {
        VStack(spacing: 0) {
            urlBar
            progressBar
            ACIBrowserWebView(controller: controller)
                .onAppear { controller.loadIfNeeded(initialURL) }
            toolbar
        }
        .background(Color("BgPrimary"))
        .onChange(of: controller.navigation.url) { _, newURL in
            // Follow navigations unless the user is mid-edit in the bar.
            if !urlFieldFocused, let newURL {
                urlText = newURL.absoluteString
            }
        }
    }

    // MARK: - URL bar

    private var urlBar: some View {
        HStack(spacing: 8) {
            Button(action: onExit) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)

            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundColor(Color("TextSecondary"))
                TextField("Search or enter URL", text: $urlText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .submitLabel(.go)
                    .focused($urlFieldFocused)
                    .foregroundColor(Color("TextPrimary"))
                    .font(.system(size: 14))
                    .onSubmit {
                        let input = urlText
                        urlFieldFocused = false
                        controller.load(ACIWebInput.resolve(input))
                    }
                if controller.navigation.isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding(.horizontal, 10)
            .frame(height: 36)
            .background(Color("BgSecondary"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .stroke(urlFieldFocused ? theme.accentGlow : Color("BorderSubtle"), lineWidth: 1)
            )
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Progress bar

    private var progressBar: some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(theme.accent)
                .frame(width: geometry.size.width * controller.navigation.progress, height: 2)
                .opacity(controller.navigation.isLoading ? 1 : 0)
                .animation(.easeOut(duration: 0.2), value: controller.navigation.progress)
        }
        .frame(height: 2)
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 0) {
            toolbarButton("chevron.left", enabled: controller.navigation.canGoBack) {
                controller.goBack()
            }
            toolbarButton("chevron.right", enabled: controller.navigation.canGoForward) {
                controller.goForward()
            }
            Spacer()
            toolbarButton("arrow.clockwise", enabled: true) {
                controller.reload()
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    private func toolbarButton(_ icon: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(enabled ? theme.accent : Color("TextSecondary").opacity(0.4))
                .frame(width: 44, height: 36)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: - WKWebView representable

/// Thin `WKWebView` wrapper. Unlike `SandboxedArtifactWebView` there is no
/// scheme handler, no CSP and no navigation policy — full browsing is the
/// point. Delegate conformances live in an extension, matching the existing
/// representable idiom: `WKNavigationDelegate` is main-actor-annotated in
/// the SDK, so the conformance is inferred main-actor-isolated and can push
/// straight into the @MainActor controller.
private struct ACIBrowserWebView: UIViewRepresentable {
    let controller: ACIBrowserController

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller)
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        controller.webView = webView
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Nothing to sync — loads are imperative (ACIBrowserController), and
        // re-loading here would reset the page on every SwiftUI pass (the bug
        // the artifact webview's lastLoaded guard exists against).
    }

    final class Coordinator: NSObject {
        private let controller: ACIBrowserController

        init(controller: ACIBrowserController) {
            self.controller = controller
        }

        @MainActor func sync(_ webView: WKWebView, isLoading: Bool, progress: Double) {
            controller.update { state in
                state.url = webView.url ?? state.url
                state.canGoBack = webView.canGoBack
                state.canGoForward = webView.canGoForward
                state.isLoading = isLoading
                state.progress = progress
            }
        }
    }
}

// MARK: - WKNavigationDelegate

extension ACIBrowserWebView.Coordinator: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        sync(webView, isLoading: true, progress: 0.15)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        sync(webView, isLoading: true, progress: 0.6)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        sync(webView, isLoading: false, progress: 1)
    }

    func webView(_ webView: WKWebView,
                 didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        sync(webView, isLoading: false, progress: 0)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        sync(webView, isLoading: false, progress: 0)
    }
}
