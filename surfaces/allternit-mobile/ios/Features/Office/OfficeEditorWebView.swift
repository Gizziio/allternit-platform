import SwiftUI
import WebKit

/// Interactive office editor in a WKWebView — loads the platform surface's
/// editor route (`/docs|/sheets|/slides|/pdf/:artifactId`).
///
/// The initial navigation carries the Clerk/runtime Bearer. NOTE: XHRs the
/// SPA then makes to `/api/*` go out WITHOUT the token (WKWebView only signs
/// the request we hand it). Against the local gateway this is covered by the
/// desktop/local-dev auth path; full per-request auth bridging for iOS is a
/// Phase 4 follow-up. The Phase 4 read-only deliverable is
/// `OfficeDocumentView`; this view is the upgrade path to the real editor.
struct OfficeEditorWebView: UIViewRepresentable {
    let family: OfficeFamily
    let artifactId: String

    /// Platform web root: the gateway serves the platform's static UI at its
    /// root, so strip `/api...` from the configured API base.
    static func platformBaseURL() -> URL {
        var components = URLComponents(url: AppConfig.apiBaseURL, resolvingAgainstBaseURL: false)
        components?.path = ""
        components?.query = nil
        return components?.url ?? AppConfig.apiBaseURL
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        let url = Self.platformBaseURL()
            .appendingPathComponent(family.editorPath)
            .appendingPathComponent(artifactId)
        context.coordinator.load(url: url, into: webView)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        func load(url: URL, into webView: WKWebView) {
            Task {
                var request = URLRequest(url: url)
                if let token = try? await AuthManager.shared.effectiveToken(), !token.isEmpty {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                webView.load(request)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            logFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            logFailure(error)
        }

        private func logFailure(_ error: Error) {
            NSLog("[OfficeEditorWebView] navigation failed: \(error.localizedDescription)")
        }
    }
}
