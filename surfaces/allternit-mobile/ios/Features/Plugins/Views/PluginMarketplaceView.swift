import SwiftUI

// -----------------------------------------------------------------------------
// PluginMarketplaceView — iOS lite port of the web PluginMarketplace.
//
// Lists bundled marketplace plugins with category filters and search. Toggling
// enabled state is persisted locally; iOS does not execute plugin code, so this
// is a registry/catalog surface only.
// -----------------------------------------------------------------------------

struct PluginMarketplaceView: View {
    @Binding var isSidebarOpen: Bool
    @StateObject private var store = PluginStore.shared

    @State private var searchText = ""
    @State private var selectedCategory: PluginCategory = .all

    private var visiblePlugins: [MarketplacePlugin] {
        store.filtered(category: selectedCategory, query: searchText)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                headerBar
                Divider().background(Color("BorderSubtle"))
                categoryPicker
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Button(action: {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.impactOccurred()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.86, blendDuration: 0)) {
                    isSidebarOpen.toggle()
                }
            }) {
                Image(systemName: "line.3.horizontal")
                    .font(.title3)
                    .foregroundColor(Color("TextPrimary"))
                    .frame(width: 44, height: 44)
            }

            Text("Plugin Marketplace")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()

            Text("\(store.enabledIds.count) enabled")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color("BgPanel"))
                .clipShape(Capsule())
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Category picker

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(PluginCategory.allCases) { category in
                    Button(action: { selectedCategory = category }) {
                        Text(category.label)
                            .font(.subheadline)
                            .fontWeight(selectedCategory == category ? .semibold : .regular)
                            .foregroundColor(selectedCategory == category ? Color("AccentPrimary") : Color("TextSecondary"))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(selectedCategory == category ? Color("AccentPrimary").opacity(0.14) : Color("BgPanel"))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 0) {
            searchBar
                .padding(.horizontal, 12)
                .padding(.vertical, 10)

            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(visiblePlugins) { plugin in
                        PluginCard(plugin: plugin, isEnabled: store.isEnabled(pluginId: plugin.id)) {
                            store.toggle(pluginId: plugin.id)
                        }
                    }
                }
                .padding(12)
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
            TextField("Search plugins", text: $searchText)
                .font(.subheadline)
                .foregroundColor(Color("TextPrimary"))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.subheadline)
                        .foregroundColor(Color("TextSecondary"))
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color("BgSecondary"))
        .cornerRadius(10)
    }
}

// MARK: - Plugin card

struct PluginCard: View {
    let plugin: MarketplacePlugin
    let isEnabled: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "puzzlepiece.extension")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color(hex: plugin.colorHex))
                    .frame(width: 40, height: 40)
                    .background(Color(hex: plugin.colorHex).opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                VStack(alignment: .leading, spacing: 2) {
                    Text(plugin.name)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color("TextPrimary"))
                    Text("by \(plugin.author)")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }

                Spacer()

                if plugin.verified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundColor(Color(hex: "#3b82f6"))
                }
            }

            Text(plugin.description)
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))
                .lineLimit(2)

            HStack(spacing: 8) {
                CategoryBadge(label: plugin.category.label, colorHex: plugin.colorHex)
                SourceBadge(source: plugin.source)
                PriceBadge(price: plugin.price)
                Spacer()
            }

            HStack(spacing: 12) {
                if plugin.ratingCount > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundColor(Color(hex: "#f59e0b"))
                        Text(String(format: "%.1f", plugin.ratingAverage))
                            .font(.caption2)
                            .foregroundColor(Color("TextSecondary"))
                    }
                }

                HStack(spacing: 4) {
                    Image(systemName: "arrow.down.circle")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                    Text("\(plugin.downloads)")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                }

                Text("v\(plugin.version)")
                    .font(.caption2)
                    .foregroundColor(Color("TextTertiary"))

                Spacer()
            }

            Button(action: onToggle) {
                Text(isEnabled ? "Disable" : "Enable")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(isEnabled ? Color(hex: "#f59e0b").opacity(0.14) : Color(hex: plugin.colorHex).opacity(0.14))
                    .foregroundColor(isEnabled ? Color(hex: "#f59e0b") : Color(hex: plugin.colorHex))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(Color("BgPanel"))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isEnabled ? Color(hex: plugin.colorHex) : Color("BorderSubtle"), lineWidth: isEnabled ? 2 : 1)
        )
    }
}

// MARK: - Badges

struct CategoryBadge: View {
    let label: String
    let colorHex: String

    var body: some View {
        Text(label)
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundColor(Color(hex: colorHex))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(Color(hex: colorHex).opacity(0.12))
            .clipShape(Capsule())
    }
}

struct SourceBadge: View {
    let source: PluginSource

    var body: some View {
        Text(source == .vendor ? "Vendor" : "Built-in")
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundColor(Color("TextSecondary"))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(Color("BgSecondary"))
            .clipShape(Capsule())
    }
}

struct PriceBadge: View {
    let price: String

    var body: some View {
        Text(price)
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundColor(Color(hex: "#22c55e"))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(Color(hex: "#22c55e").opacity(0.12))
            .clipShape(Capsule())
    }
}
