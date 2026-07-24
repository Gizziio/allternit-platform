import SwiftUI
import UIKit
import SwiftTerm

/// Interactive terminal flipped to from the code thread: attaches to a pty on
/// the standalone gizzi-code server (Core/API/PtyClient.swift) and renders it
/// with SwiftTerm.
///
/// The session is injected by the hosting thread view, so flipping between
/// chat and terminal (or navigating away and back) reattaches to the SAME
/// shell — ptys survive client disconnects server-side.
struct TerminalSessionView: View {
    @ObservedObject var session: PtySession

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            PtyTerminalRepresentable(session: session)

            switch session.state {
            case .connecting:
                VStack(spacing: 8) {
                    ProgressView("Connecting…")
                        .tint(.white)
                        .foregroundColor(.white)
                    if let name = session.attachedInstanceName {
                        Text(name)
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
            case .failed(let message):
                statusBanner(icon: "exclamationmark.triangle", text: message, showsRetry: true)
            case .exited:
                statusBanner(icon: "power", text: "Process exited.", showsRetry: true)
            case .live:
                EmptyView()
            }
        }
        .task {
            await session.start()
        }
        .onDisappear {
            // Detach when flipping back to chat — the emulator UIView is
            // destroyed, so output arriving while hidden would be lost.
            // Reappearing reconnects to the SAME pty (PtySession keeps the
            // id) and the server's full scrollback replay restores the
            // screen exactly as left.
            session.stop()
        }
    }

    private func statusBanner(icon: String, text: String, showsRetry: Bool) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.white.opacity(0.7))
            Text(text)
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
            if showsRetry {
                Button("New Session") {
                    Task { await session.retry() }
                }
                .font(.subheadline.weight(.semibold))
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

// MARK: - SwiftTerm representable

/// `TerminalView` wrapper mirroring the WKWebView representable idiom
/// (SandboxedArtifactWebView): output is fed imperatively via
/// `PtySession.onOutput`, input flows back through the delegate — nothing is
/// synced in `updateUIView`, so SwiftUI passes never disturb the emulator.
private struct PtyTerminalRepresentable: UIViewRepresentable {
    let session: PtySession

    func makeCoordinator() -> Coordinator {
        Coordinator(session: session)
    }

    func makeUIView(context: Context) -> TerminalView {
        let terminalView = TerminalView(frame: .zero)
        terminalView.terminalDelegate = context.coordinator
        session.onOutput = { [weak terminalView] text in
            terminalView?.feed(text: text)
        }
        return terminalView
    }

    func updateUIView(_ uiView: TerminalView, context: Context) {
        // Nothing to sync — output is pushed via onOutput, and re-feeding
        // here would corrupt the emulator state on every SwiftUI pass.
    }

    /// Non-isolated like SandboxedArtifactWebView.Coordinator: SwiftTerm is a
    /// pre-concurrency module, so the delegate requirements are non-isolated
    /// witnesses; calls into the @MainActor session hop explicitly.
    final class Coordinator: NSObject {
        let session: PtySession

        init(session: PtySession) {
            self.session = session
        }
    }
}

extension PtyTerminalRepresentable.Coordinator: TerminalViewDelegate {
    /// User keystrokes → pty stdin (text frames, verbatim).
    func send(source: TerminalView, data: ArraySlice<UInt8>) {
        let text = String(decoding: data, as: UTF8.self)
        let session = self.session
        Task { @MainActor in session.send(text) }
    }

    /// SwiftTerm auto-resizes the emulator when the view's frame changes;
    /// forward the new grid size over REST (resize never goes over the socket).
    func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
        let session = self.session
        Task { @MainActor in session.resize(cols: newCols, rows: newRows) }
    }

    func setTerminalTitle(source: TerminalView, title: String) {
        // The thread's navigation title stays the session title.
    }

    func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {
    }

    func scrolled(source: TerminalView, position: Double) {
    }

    /// Rendered-range repaint hint — SwiftTerm redraws itself; no-op here.
    /// (Required since SwiftTerm 1.2.2; `bell`/`clipboardRead`/`iTermContent`
    /// have library defaults and stay unimplemented.)
    func rangeChanged(source: TerminalView, startY: Int, endY: Int) {
    }

    func requestOpenLink(source: TerminalView, link: String, params: [String: String]) {
        guard let url = URL(string: link),
              let scheme = url.scheme,
              scheme.hasPrefix("http") else { return }
        Task { @MainActor in UIApplication.shared.open(url) }
    }

    func clipboardCopy(source: TerminalView, content: Data) {
        let text = String(decoding: content, as: UTF8.self)
        Task { @MainActor in UIPasteboard.general.string = text }
    }
}
