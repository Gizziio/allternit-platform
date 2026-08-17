import SwiftUI
import PencilKit
import PDFKit

/// iOS parity for the platform's Site APIs / ApiCaptureView.
/// A compact surface for managing API contracts with a CTA that opens the
/// browser to create or edit APIs on the platform.
struct SiteAPIsView: View {
    @State private var contracts: [String] = ["api.example.com"]
    @State private var isBrowserPresented = false
    @State private var browserURL: URL? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        createSection
                        contractsSection
                    }
                    .padding(20)
                }
            }
            .background(Color("BgPrimary").ignoresSafeArea())
            .navigationTitle("Site APIs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: Binding(
                get: { browserURL != nil },
                set: { if !$0 { browserURL = nil } }
            )) {
                if let url = browserURL {
                    SafariView(url: url)
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "globe")
                .font(.system(size: 22, weight: .medium))
                .foregroundColor(Color("AccentPrimary"))
                .frame(width: 48, height: 48)
                .background(Color("AccentPrimary").opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))

            VStack(alignment: .leading, spacing: 4) {
                Text("Site APIs")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.semibold)
                    .foregroundColor(Color("TextPrimary"))
                Text("Capture, replay, and publish API contracts.")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
            }

            Spacer()
        }
        .padding(20)
    }

    private var createSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Create")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))

            Button(action: openCreateInBrowser) {
                HStack(spacing: 10) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(Color("AccentPrimary"))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("New API contract")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Color("TextPrimary"))
                        Text("Open the platform to capture endpoints.")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                    }
                    Spacer()
                    Image(systemName: "arrow.up.forward.square")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color("TextSecondary"))
                }
                .padding(.horizontal, 14)
                .frame(height: 64)
                .background(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .fill(Color("BgPanel").opacity(0.55))
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.radiusLG))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusLG)
                        .stroke(Color("BorderSubtle").opacity(0.55), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var contractsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Contracts by domain")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Color("TextSecondary"))

            VStack(spacing: 8) {
                ForEach(contracts, id: \.self) { domain in
                    Button(action: { openContract(domain) }) {
                        HStack(spacing: 10) {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(Color("AccentPrimary"))
                            Text(domain)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(Color("TextPrimary"))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color("TextSecondary"))
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 48)
                        .background(Color("BgPanel").opacity(0.55))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.radiusMD)
                                .stroke(Color("BorderSubtle").opacity(0.55), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func openCreateInBrowser() {
        browserURL = URL(string: "https://platform.allternit.com/site-apis")
    }

    private func openContract(_ domain: String) {
        browserURL = URL(string: "https://platform.allternit.com/site-apis?domain=\(domain)")
    }
}
