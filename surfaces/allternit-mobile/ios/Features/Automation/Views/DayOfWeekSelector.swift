import SwiftUI

/// Day-of-week selector that supplements a cron expression — a SwiftUI port
/// of `DayOfWeekSelector` from the web implementation
/// (surfaces/ai.allternit.com/src/views/cowork/DayOfWeekSelector.tsx).
/// `selectedDays` holds weekday numbers where 0 = Sunday ... 6 = Saturday;
/// the parent is responsible for syncing them with the cron day-of-week
/// field via `CronDays.parseCronDays`/`CronDays.applyCronDays`.
struct DayOfWeekSelector: View {
    let selectedDays: [Int]
    let onChange: ([Int]) -> Void
    var disabled = false

    private static let dayLabels = ["S", "M", "T", "W", "T", "F", "S"]
    private static let dayTitles = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(Self.dayLabels.indices, id: \.self) { day in
                let isSelected = selectedDays.contains(day)
                Button(action: { toggle(day) }) {
                    Text(Self.dayLabels[day])
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(isSelected ? Color("BgPanel") : Color("TextSecondary"))
                        .frame(width: 36, height: 36)
                        .background(isSelected ? Color("TextPrimary") : Color("BgPanel"))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.radiusSM)
                                .stroke(isSelected ? Color("TextPrimary") : Theme.borderWarmDefault, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .accessibilityLabel(Text(Self.dayTitles[day]))
            }
        }
        .opacity(disabled ? 0.5 : 1)
    }

    private func toggle(_ day: Int) {
        guard !disabled else { return }
        var next = Set(selectedDays)
        if next.contains(day) {
            next.remove(day)
        } else {
            next.insert(day)
        }
        onChange(next.sorted())
    }
}
