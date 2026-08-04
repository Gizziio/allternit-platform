import SwiftUI

/// Udemy Catalog tab surface — mirrors the web's `CatalogView`.
///
/// Phase 1: browse A://Labs categories, search/filter Udemy's public catalog
/// via `POST /api/v1/udemy/search`, and curate courses locally. Course detail
/// player and notebook sync are deferred.
struct CatalogView: View {
    @Binding var isSidebarOpen: Bool

    @StateObject private var store = UdemyCatalogStore.shared

    @State private var searchText = ""
    @State private var priceFilter = "free"
    @State private var levelFilter = "all"
    @State private var safariURL: IdentifiableURL? = nil

    private var effectiveLevel: String? {
        levelFilter == "all" ? nil : levelFilter
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                Divider().background(Color("BorderSubtle"))
                filtersBar
                Divider().background(Color("BorderSubtle"))
                content
            }
            .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(item: $safariURL) { wrapper in
            SafariView(url: wrapper.url)
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

            Text("Udemy Catalog")
                .font(.system(.title3, design: .serif))
                .fontWeight(.medium)
                .foregroundColor(Color("TextPrimary"))

            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color("BgPrimary"))
    }

    // MARK: - Filters

    private var filtersBar: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline)
                    .foregroundColor(Color("TextSecondary"))
                TextField("Search Udemy courses", text: $searchText)
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { runSearch() }
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

            Picker("Price", selection: $priceFilter) {
                Text("Free").tag("free")
                Text("Paid").tag("paid")
                Text("All").tag("all")
            }
            .pickerStyle(.menu)
            .frame(width: 80)
            .onChange(of: priceFilter) { _, _ in runSearch() }

            Picker("Level", selection: $levelFilter) {
                Text("All").tag("all")
                Text("Beginner").tag("Beginner")
                Text("Intermediate").tag("Intermediate")
                Text("Expert").tag("Expert")
            }
            .pickerStyle(.menu)
            .frame(width: 100)
            .onChange(of: levelFilter) { _, _ in runSearch() }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color("BgPrimary"))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.courses.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.courses.isEmpty {
            Spacer()
            VStack(spacing: 12) {
                Text("Couldn't search Udemy")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") { runSearch() }
                    .font(.subheadline)
                    .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else if store.courses.isEmpty && searchText.isEmpty {
            ScrollView {
                categoryGrid
            }
            .scrollDismissesKeyboard(.interactively)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if store.resultCount > 0 {
                        Text("\(store.resultCount) courses")
                            .font(.caption)
                            .foregroundColor(Color("TextSecondary"))
                            .padding(.horizontal, 16)
                    }
                    LazyVStack(spacing: 10) {
                        ForEach(store.courses) { course in
                            courseRow(course)
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.vertical, 16)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // MARK: - Category grid

    private var categoryGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            ForEach(A2LabsCategory.all) { category in
                CategoryCard(category: category) {
                    searchText = category.searchQueries.first ?? category.label
                    runSearch()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 16)
    }

    // MARK: - Course row

    private func courseRow(_ course: UdemyCourse) -> some View {
        HStack(spacing: 12) {
            if let imageURL = URL(string: course.image240x135) {
                AsyncImage(url: imageURL) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Color("BgSecondary")
                    }
                }
                .frame(width: 80, height: 45)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(course.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                    .lineLimit(2)
                Text(course.headline)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Label(String(format: "%.1f", course.rating), systemImage: "star.fill")
                        .font(.caption2)
                        .foregroundColor(Theme.statusWarning)
                    Text("(\(course.numReviews))")
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                    Text(course.level)
                        .font(.caption2)
                        .foregroundColor(Color("TextSecondary"))
                    if !course.isPaid {
                        Text("Free")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(Theme.statusSuccess)
                    }
                }
            }

            Spacer()

            Button(action: { store.toggleCurated(course) }) {
                Image(systemName: store.isCurated(course) ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(store.isCurated(course) ? Color("AccentPrimary") : Color("TextSecondary"))
            }
        }
        .padding(12)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { openCourse(course) }
    }

    // MARK: - Category card

    private struct CategoryCard: View {
        let category: A2LabsCategory
        let action: () -> Void

        var body: some View {
            Button(action: action) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(category.tier)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(Color("AccentPrimary"))
                        .textCase(.uppercase)
                    Text(category.label)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color("TextPrimary"))
                        .lineLimit(2)
                    Text(category.description)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                        .lineLimit(3)
                    Spacer(minLength: 0)
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
    }

    // MARK: - Actions

    private func runSearch() {
        Task {
            await store.search(query: searchText, price: priceFilter, level: effectiveLevel)
        }
    }

    private func openCourse(_ course: UdemyCourse) {
        let path = course.url.hasPrefix("http") ? course.url : "https://www.udemy.com\(course.url)"
        if let url = URL(string: path) {
            safariURL = IdentifiableURL(url: url)
        }
    }
}
