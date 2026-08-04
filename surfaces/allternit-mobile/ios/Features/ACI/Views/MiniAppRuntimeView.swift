import SwiftUI
import WebKit

/// Phase-1 Mini-app runtime host for iOS.
///
/// Mirrors the web's `MiniAppRuntimeSurface.tsx`:
/// - If the app declares a `uiUrl`, load it in a WKWebView.
/// - Otherwise, render a native-capabilities placeholder.
struct MiniAppRuntimeView: View {
    let app: MiniApp

    private var uiURL: URL? {
        // Web resolves presentation.uiUrl from the manifest. Phase 1 on iOS
        // uses the app's top-level URL as a fallback when no explicit uiUrl
        // is encoded in the model.
        URL(string: app.url)
    }

    var body: some View {
        VStack(spacing: 0) {
            if let url = uiURL {
                WebView(url: url)
                    .edgesIgnoringSafeArea(.bottom)
            } else {
                nativeCapabilitiesPlaceholder
            }
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .navigationTitle(app.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Native capabilities placeholder

    private var nativeCapabilitiesPlaceholder: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack(spacing: 12) {
                    Image(systemName: "cpu")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(Color("AccentPrimary"))
                        .frame(width: 48, height: 48)
                        .background(Color("BgPanel"))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(app.name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                        Text("Native Allternit capabilities")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                    }

                    Spacer()
                }

                VStack(spacing: 8) {
                    ForEach(capabilities, id: \.self) { capability in
                        HStack(spacing: 10) {
                            Image(systemName: "wrench")
                                .font(.system(size: 13))
                                .foregroundColor(Color("AccentPrimary"))
                            Text(capability)
                                .font(.subheadline)
                                .foregroundColor(Color("TextPrimary"))
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 48)
                        .background(Color("BgPanel"))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.radiusMD)
                                .stroke(Theme.borderWarmDefault, lineWidth: 1)
                        )
                    }
                }
            }
            .padding(20)
        }
    }

    private var capabilities: [String] {
        if !app.capabilities.isEmpty {
            return app.capabilities
        }
        return ["Managed miniapp"]
    }
}

// MARK: - WKWebView wrapper

private struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
