import SwiftUI

/// Deterministic Allternit-mark avatar: a 5x5 mirrored pixel glyph derived
/// from a stable hash of the seed (the agent id, or a "grid:" avatar
/// seed), in the platform's warm palette with accent cells — the same
/// tiled motif as the app logo. This replaces the generic SF Symbol
/// fallback: every agent gets a distinctive mark with zero setup, and the
/// mark never changes between launches.
struct AgentIdenticonView: View {
    let seed: String
    var size: CGFloat = 40

    /// Warm tan for the bulk cells (the logo's sand tiles).
    private let warm = Color(red: 0.78, green: 0.70, blue: 0.58)
    /// Logo red-orange for the sparse accent cells.
    private let accent = Color("AccentPrimary")

    /// FNV-1a 64-bit — stable across launches (Swift's Hasher is seeded
    /// per process and would reshuffle tiles every launch).
    private static func hash(_ s: String) -> UInt64 {
        var h: UInt64 = 0xcbf29ce484222325
        for byte in s.utf8 {
            h ^= UInt64(byte)
            h &*= 0x100000001b3
        }
        return h
    }

    var body: some View {
        Canvas { context, canvasSize in
            let h = Self.hash(seed)
            let tintHash = Self.hash(seed + "~tint")
            let unit = canvasSize.width / 5

            // 15 bits → 3 columns × 5 rows, mirrored to 5 columns. Bit 12
            // is forced on so no seed ever produces an empty tile.
            for row in 0..<5 {
                for col in 0..<3 {
                    let bitIndex = UInt64(row * 3 + col)
                    let filled = ((h >> bitIndex) & 1) == 1 || bitIndex == 12
                    guard filled else { continue }
                    let isAccent = ((tintHash >> bitIndex) & 0b11) == 0
                    let color = isAccent ? accent : warm
                    let cell = CGSize(width: unit * 0.84, height: unit * 0.84)
                    let radius = unit * 0.22
                    for x in [CGFloat(col) * unit, CGFloat(4 - col) * unit] {
                        let rect = CGRect(origin: CGPoint(x: x, y: CGFloat(row) * unit), size: cell)
                        context.fill(
                            Path(roundedRect: rect, cornerRadius: radius),
                            with: .color(color)
                        )
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Agent mark")
    }
}
