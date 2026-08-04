import SwiftUI

/// Products Discovery tab surface — a browsable catalog of Allternit products
/// and surfaces, mirroring `views/products/ProductsDiscoveryView.tsx` on the
/// web. This is a static marketing surface (no backend calls); the catalog is
/// bundled in `ProductDiscoveryItem`.
struct ProductsDiscoveryView: View {
    @Binding var isSidebarOpen: Bool

    @EnvironmentObject private var modeStore: AppModeStore

    @State private var selectedCategory: ProductCategory? = nil
    @State private var spotlightIndex = 0
    @State private var safariURL: IdentifiableURL? = nil
    @State private var searchText = ""

    private let timer = Timer.publish(every: 8, on: .main, in: .common).autoconnect()

    private var filteredProducts: [ProductDiscoveryItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        var items = ProductDiscoveryItem.all
        if let selectedCategory {
            items = items.filter { $0.category == selectedCategory }
        }
        guard !query.isEmpty else { return items }
        return items.filter {
            $0.name.localizedCaseInsensitiveContains(query)
            || $0.description.localizedCaseInsensitiveContains(query)
            || $0.category.rawValue.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))
                ScrollView {
                    VStack(spacing: 20) {
                        spotlightCarousel
                        categoryChips
                        searchBar
                        productGrid
                    }
                    .padding(.vertical, 16)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(item: $safariURL) { wrapper in
            SafariView(url: wrapper.url)
        }
        .onReceive(timer) { _ in
            advanceSpotlight()
        }
    }

    // MARK: - Header

    private var header: some View {
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

            Text("Products")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Spotlight carousel

    private var spotlightCarousel: some View {
        let item = ProductDiscoveryItem.spotlight[spotlightIndex]

        return VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(item.gradient)
                        .frame(width: 52, height: 52)
                    Image(systemName: item.systemImage)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(.white)
                }
                .shadow(color: item.accentColor.opacity(0.35), radius: 16, x: 0, y: 8)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.tagline)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(item.accentColor)
                        .textCase(.uppercase)
                        .tracking(0.05)
                    Text(item.name)
                        .font(.system(.title2, design: .serif))
                        .fontWeight(.medium)
                        .foregroundColor(Color("TextPrimary"))
                }

                Spacer()
            }

            Text(item.description)
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
                .lineLimit(4)

            HStack {
                Button(action: { activate(item) }) {
                    HStack(spacing: 6) {
                        Text(ctaLabel(for: item))
                            .font(.system(size: 13, weight: .semibold))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(item.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                Spacer()

                HStack(spacing: 6) {
                    ForEach(0..<ProductDiscoveryItem.spotlight.count, id: \.self) { i in
                        Circle()
                            .fill(i == spotlightIndex ? Color("TextPrimary") : Color("TextSecondary").opacity(0.35))
                            .frame(width: 6, height: 6)
                    }
                }
            }
        }
        .padding(20)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Category chips

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                CategoryChip(
                    title: "All",
                    isSelected: selectedCategory == nil,
                    accent: Color("AccentPrimary")
                ) {
                    selectedCategory = nil
                }

                ForEach(ProductCategory.allCases, id: \.self) { category in
                    CategoryChip(
                        title: category.rawValue,
                        isSelected: selectedCategory == category,
                        accent: Color("AccentPrimary")
                    ) {
                        selectedCategory = category
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Search

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline)
                .foregroundColor(Color("TextSecondary"))
            TextField("Search products", text: $searchText)
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
        .padding(.horizontal, 16)
    }

    // MARK: - Product grid

    private var productGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            ForEach(filteredProducts) { product in
                ProductCard(product: product) {
                    activate(product)
                }
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Actions

    private func activate(_ item: ProductDiscoveryItem) {
        if let urlString = item.externalURL, let url = URL(string: urlString) {
            safariURL = IdentifiableURL(url: url)
            return
        }
        switch item.viewType {
        case "chat", "cowork":
            modeStore.selectBarItem(.chats)
        case "code", "allternit-canvas":
            modeStore.selectBarItem(.code)
        case "operator", "browser":
            modeStore.selectBarItem(.aci)
        case "agent-hub", "swarm":
            modeStore.selectBarItem(.agents)
        default:
            break
        }
    }

    private func ctaLabel(for item: ProductDiscoveryItem) -> String {
        if item.externalURL != nil { return "Open" }
        switch item.viewType {
        case "chat": return "Open Chat"
        case "code": return "Open Code"
        case "operator": return "Open Operator"
        case "swarm": return "Open Swarm"
        case "agent-hub": return "Open Agent Hub"
        default: return "Explore"
        }
    }

    private func advanceSpotlight() {
        spotlightIndex = (spotlightIndex + 1) % ProductDiscoveryItem.spotlight.count
    }
}

// MARK: - Product card

private struct ProductCard: View {
    let product: ProductDiscoveryItem
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: product.systemImage)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(product.accentColor)
                        .frame(width: 36, height: 36)
                        .background(product.accentColor.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 10))

                    Spacer()

                    Text(product.status.label)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .tracking(0.03)
                        .foregroundColor(statusColor(product.status))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(statusColor(product.status).opacity(0.12))
                        .clipShape(Capsule())
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(product.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(1)

                    Text(product.description)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(2)
                }
            }
            .padding(14)
            .frame(minHeight: 120, alignment: .top)
            .background(Color("BgPanel"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func statusColor(_ status: ProductStatus) -> Color {
        switch status {
        case .live: return Theme.statusSuccess
        case .beta: return Theme.statusWarning
        case .soon: return Color("TextSecondary")
        }
    }
}

// MARK: - Category chip

private struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        }) {
            Text(title)
                .font(.caption)
                .fontWeight(isSelected ? .bold : .medium)
                .foregroundColor(isSelected ? Color("BgPrimary") : Color("TextPrimary"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(isSelected ? accent : Color("BgPanel"))
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : Theme.borderWarmDefault, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
