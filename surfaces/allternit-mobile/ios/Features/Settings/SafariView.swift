import SwiftUI
import SafariServices

/// Shared thin `SFSafariViewController` wrapper for in-app browsing (export
/// data, support links). Mirrors the private copy in ConnectorsListView,
/// which stays file-scoped to its OAuth flow.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

/// `URL` isn't `Identifiable`; wrap it for `.sheet(item:)`.
struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
