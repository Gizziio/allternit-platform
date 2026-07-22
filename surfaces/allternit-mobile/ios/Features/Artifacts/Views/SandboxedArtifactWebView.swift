import SwiftUI
import WebKit

/// Sandboxed full-screen artifact preview (plan §3: "Artifact Preview tab").
///
/// The artifact HTML is served from memory over a custom `artifact://` scheme
/// via a `WKURLSchemeHandler` — never from a real http(s) base URL — and is
/// locked down three ways:
///
/// 1. CSP meta injected into the document:
///    `default-src 'none'; style-src 'unsafe-inline'; img-src data:;`
///    plus `script-src 'unsafe-inline'` ONLY for artifact types that need JS.
/// 2. `WKWebpagePreferences.allowsContentJavaScript` (the modern per-navigation
///    API — NOT the deprecated `preferences.javaScriptEnabled`): off for
///    svg/css/text, on for html/js types.
/// 3. `decidePolicyFor` cancels every navigation that is not the sandbox
///    document itself or `about:blank` (links, redirects, window.open).
struct SandboxedArtifactWebView: UIViewRepresentable {
    // The scheme constants and document-assembly helpers are pure and used
    // from the non-isolated Coordinator — `nonisolated` opts them out of the
    // MainActor isolation UIViewRepresentable puts on this struct (Swift 6.0
    // has no cross-actor conformance inference to paper over it).

    /// Custom scheme served by the coordinator's scheme handler.
    nonisolated static let scheme = "artifact"
    /// The single document URL the handler will serve.
    nonisolated static let documentURL = URL(string: "artifact://artifact/")!

    let content: String
    let artifactType: String

    /// JavaScript is enabled only for artifact types that can execute it
    /// meaningfully (html documents, javascript sources).
    nonisolated static func allowsJavaScript(for artifactType: String) -> Bool {
        let type = artifactType.lowercased()
        return type.contains("html")
            || type.contains("javascript")
            || type == "js"
            || type == "jsx"
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(context.coordinator, forURLScheme: Self.scheme)
        // Default deny; the navigation delegate opts JS in per navigation.
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = false
        configuration.defaultWebpagePreferences = preferences

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.allowsJavaScript = Self.allowsJavaScript(for: artifactType)
        context.coordinator.loadIfNeeded(content: content, artifactType: artifactType, into: uiView)
    }

    // MARK: - Document assembly

    /// CSP per plan §3: no network, frames, fonts, or plugins; inline styles
    /// and `data:` images only. `script-src 'unsafe-inline'` is appended
    /// exclusively for artifact types that need JS.
    nonisolated static func contentSecurityPolicy(allowsJavaScript: Bool) -> String {
        var csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:;"
        if allowsJavaScript {
            csp += " script-src 'unsafe-inline';"
        }
        return csp
    }

    /// Builds the final HTML document served to the web view.
    nonisolated static func document(content: String, artifactType: String) -> String {
        let js = allowsJavaScript(for: artifactType)
        let meta = "<meta http-equiv=\"Content-Security-Policy\" content=\"\(contentSecurityPolicy(allowsJavaScript: js))\">"
        let type = artifactType.lowercased()

        if type.contains("svg") || type.contains("image/svg") {
            // SVG viewport wrapper (kept from v1) with a CSP-injected head.
            return """
            <!DOCTYPE html>
            <html>
            <head>
            \(meta)
            <style>
            body {
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background-color: transparent;
            }
            svg {
                max-width: 100%;
                max-height: 100%;
            }
            </style>
            </head>
            <body>
            \(content)
            </body>
            </html>
            """
        }

        if type.contains("html") {
            // Full HTML document — inject the CSP into its own head.
            return injectCSP(meta, into: content)
        }

        // css / javascript / plain text — show the source, escaped, in a
        // minimal shell (raw passthrough would let the text parse as markup).
        return """
        <!DOCTYPE html>
        <html>
        <head>
        \(meta)
        <style>
        body {
            margin: 0;
            padding: 12px;
            background-color: transparent;
        }
        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        </style>
        </head>
        <body><pre>\(escapeHTML(content))</pre></body>
        </html>
        """
    }

    /// Injects the CSP meta into an existing `<head>` when present; otherwise
    /// creates one after `<html>`; otherwise prepends. Same approach as the
    /// web's storage-shim injector (ArtifactRenderer.tsx).
    nonisolated static func injectCSP(_ meta: String, into html: String) -> String {
        if let headTag = html.range(of: "<head[^>]*>", options: [.regularExpression, .caseInsensitive]) {
            return html.replacingCharacters(in: headTag, with: String(html[headTag]) + "\n" + meta)
        }
        if let htmlTag = html.range(of: "<html[^>]*>", options: [.regularExpression, .caseInsensitive]) {
            return html.replacingCharacters(in: htmlTag, with: String(html[htmlTag]) + "\n<head>" + meta + "</head>")
        }
        return meta + "\n" + html
    }

    nonisolated static func escapeHTML(_ string: String) -> String {
        string
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    // MARK: - Coordinator

    /// Conformances live in extensions below: `WKNavigationDelegate`'s
    /// requirements are main-actor-annotated in the SDK (the witness carries
    /// an explicit `@MainActor`), while `WKURLSchemeHandler` may be called
    /// off the main thread — so this class deliberately stays non-isolated.
    /// Its state is only mutated on the main thread (via `updateUIView`),
    /// strictly before the matching `load` call, so the handler never reads
    /// a torn value.
    final class Coordinator: NSObject {
        /// Mirrors `SandboxedArtifactWebView.allowsJavaScript(for:)` for the
        /// current artifact; read by the navigation delegate.
        var allowsJavaScript = false

        /// The document currently served for `artifact://` requests.
        /// `loadIfNeeded` runs on the main actor; the scheme handler may run
        /// off the main thread, so the document is guarded by a lock.
        private let documentLock = NSLock()
        private var servedDocument = Data()

        /// Content/type of the last issued load. Guards the v1 reload bug:
        /// `updateUIView` runs on every SwiftUI pass, and v1 reloaded the
        /// page (losing scroll/interaction state) every time.
        private var lastLoadedContent: String?
        private var lastLoadedType: String?

        @MainActor
        func loadIfNeeded(content: String, artifactType: String, into webView: WKWebView) {
            guard content != lastLoadedContent || artifactType != lastLoadedType else { return }
            lastLoadedContent = content
            lastLoadedType = artifactType
            let documentData = Data(SandboxedArtifactWebView.document(content: content, artifactType: artifactType).utf8)
            documentLock.withLock {
                servedDocument = documentData
            }
            webView.load(URLRequest(url: SandboxedArtifactWebView.documentURL))
        }

        /// Thread-safe copy of the current sandbox document.
        private var currentDocument: Data {
            documentLock.withLock { servedDocument }
        }
    }
}

// MARK: - WKNavigationDelegate

extension SandboxedArtifactWebView.Coordinator: WKNavigationDelegate {
    /// Modern per-navigation policy + JS preference API (iOS 15+). Only the
    /// sandbox document and `about:blank` are allowed; everything else —
    /// http(s) links, redirects, `window.open` — is cancelled.
    /// `@MainActor` matches the SDK requirement's isolation explicitly —
    /// Swift 6.0 doesn't infer it for witnesses of a non-isolated class.
    @MainActor
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 preferences: WKWebpagePreferences,
                 decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        let url = navigationAction.request.url
        let isSandboxDocument = url?.scheme == SandboxedArtifactWebView.scheme
        let isAboutBlank = url?.absoluteString == "about:blank"

        guard isSandboxDocument || isAboutBlank else {
            decisionHandler(.cancel, preferences)
            return
        }

        preferences.allowsContentJavaScript = allowsJavaScript
        decisionHandler(.allow, preferences)
    }
}

// MARK: - WKURLSchemeHandler

extension SandboxedArtifactWebView.Coordinator: WKURLSchemeHandler {
    /// Serves the in-memory document for the sandbox URL; anything else on
    /// the scheme fails (there are no subresources — CSP `default-src 'none'`
    /// blocks them anyway).
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              requestURL == SandboxedArtifactWebView.documentURL else {
            urlSchemeTask.didFailWithError(URLError(.resourceUnavailable))
            return
        }

        let document = currentDocument
        let response = URLResponse(
            url: requestURL,
            mimeType: "text/html",
            expectedContentLength: document.count,
            textEncodingName: "utf-8"
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(document)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Nothing to clean up — the document is served synchronously.
    }
}
