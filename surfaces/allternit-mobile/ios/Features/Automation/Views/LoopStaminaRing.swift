import SwiftUI

/// Circular iteration-budget indicator for a `Loop` — how much of its
/// `maxIterations` allowance `iterationLog` has consumed so far. Color
/// follows `LoopsListView.statusColor(_:)` so it always agrees with the
/// list row's status badge (blue while running, green once it exits clean,
/// amber once it burns through its whole iteration budget).
struct LoopStaminaRing: View {
    let loop: Loop
    var diameter: CGFloat = 30
    var lineWidth: CGFloat = 3

    private var progress: Double {
        guard loop.maxIterations > 0 else { return 0 }
        return min(1, Double(loop.iterationLog.count) / Double(loop.maxIterations))
    }

    private var color: Color {
        LoopsListView.statusColor(loop.state)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if loop.state == "running" {
                Image(systemName: "repeat")
                    .font(.system(size: diameter * 0.36, weight: .semibold))
                    .foregroundColor(color)
            }
        }
        .frame(width: diameter, height: diameter)
        .accessibilityLabel("\(loop.iterationLog.count) of \(loop.maxIterations) iterations used")
    }
}
