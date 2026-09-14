import SwiftUI

/// The Allternit wordmark rendered from the brand SVG.
///
/// Source: `surfaces/ai.allternit.com/public/brand/a-protocol/a-ternit-wordmark.svg`
/// Asset: `Assets.xcassets/AternitWordmark`.
struct WordmarkView: View {
    var height: CGFloat = 28

    var body: some View {
        Image("AternitWordmark")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(height: height)
            .accessibilityLabel("Allternit")
    }
}

#Preview {
    VStack(spacing: 24) {
        WordmarkView(height: 28)
        WordmarkView(height: 22)
        WordmarkView(height: 16)
    }
    .padding()
}
