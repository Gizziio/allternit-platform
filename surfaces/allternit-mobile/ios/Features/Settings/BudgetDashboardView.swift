import SwiftUI

/// Phase-1 Budget Dashboard for iOS.
///
/// Mirrors the web's BudgetDashboardView.tsx: stat cards, quota editor with
/// quick presets, resource pressure bars, and alerts.
struct BudgetDashboardView: View {
    @StateObject private var store = RuntimeOperationsStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var quotaDraft: String = ""
    @State private var quotaError: String? = nil

    private let quickQuotas: [Double] = [5, 10, 20, 40]

    private var pressureLabel: String {
        if store.maxPressurePercent >= 90 { return "Critical pressure" }
        if store.maxPressurePercent >= 75 { return "Warning pressure" }
        return "Comfortable headroom"
    }

    private var projectedOverrun: Double {
        guard let budget = store.budget, store.configuredCreditsPerHour > 0 else { return 0 }
        return max(0, budget.projectedHourlyCost - store.configuredCreditsPerHour)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().background(Color("BorderSubtle"))
            content
        }
        .background(Color("BgPrimary").edgesIgnoringSafeArea(.all))
        .task {
            store.fetchIfNeeded()
            quotaDraft = formatCredits(store.configuredCreditsPerHour)
        }
        .onChange(of: store.configuredCreditsPerHour) { _, newValue in
            if !store.isSavingQuota {
                quotaDraft = formatCredits(newValue)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Runtime Budget")
                    .font(.system(.title3, design: .serif))
                    .fontWeight(.medium)
                    .foregroundColor(Color("TextPrimary"))
                Text("Manage the shared runtime quota")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }

            Spacer()

            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color("TextSecondary"))
                    .frame(width: 32, height: 32)
                    .background(Color("BgPanel"))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.budget == nil {
            Spacer()
            ProgressView()
            Spacer()
        } else if let loadError = store.loadError, store.budget == nil {
            Spacer()
            VStack(spacing: 12) {
                Text("Failed to load runtime budget")
                    .font(.subheadline)
                    .foregroundColor(Color("TextPrimary"))
                Text(loadError)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    store.fetchIfNeeded(force: true)
                }
                .font(.subheadline)
                .foregroundColor(Color("AccentPrimary"))
            }
            .padding(.horizontal, 20)
            Spacer()
        } else {
            ScrollView {
                VStack(spacing: 16) {
                    statusHeader
                    statCards
                    quotaEditor
                    metricsSection
                    alertsSection
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
            .refreshable {
                await store.refresh()
            }
        }
    }

    // MARK: - Status header

    private var statusHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "wallet")
                        .font(.system(size: 12))
                        .foregroundColor(Theme.statusWarning)
                    Text("Economic Model")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(2.4)
                        .foregroundColor(Color("TextSecondary"))
                }
                Text("Runtime Budget")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
                Text("Manage the shared runtime quota and watch live resource pressure.")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
                    .lineLimit(2)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                statusBadge
                Text(pressureLabel)
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            }
        }
        .padding(16)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private var statusBadge: some View {
        let (text, color) = statusBadgeInfo
        return Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.8)
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    private var statusBadgeInfo: (text: String, color: Color) {
        guard let budget = store.budget else { return ("Unknown", Color("TextSecondary")) }
        let maxPressure = store.maxPressurePercent
        if budget.status == "exhausted" || maxPressure >= 100 {
            return ("Exhausted", Theme.statusError)
        } else if budget.status == "warning" || maxPressure >= 75 {
            return ("Warning", Theme.statusWarning)
        } else {
            return ("Healthy", Theme.statusSuccess)
        }
    }

    // MARK: - Stat cards

    private var statCards: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            statCard(
                label: "Configured / Hour",
                value: formatCredits(store.configuredCreditsPerHour),
                unit: "credits",
                icon: "dollarsign.circle",
                color: Theme.statusWarning
            )
            statCard(
                label: "Consumed This Hour",
                value: formatCredits(store.budget?.creditsConsumedThisHour ?? 0),
                unit: "credits",
                icon: "pulse",
                color: Color("AccentPrimary")
            )
            statCard(
                label: "Projected Hourly",
                value: formatCredits(store.budget?.projectedHourlyCost ?? 0),
                unit: "credits",
                icon: "bolt",
                color: Color("AccentPrimary")
            )
            statCard(
                label: "Max Pressure",
                value: String(format: "%.1f", store.maxPressurePercent),
                unit: "%",
                icon: "shield",
                color: pressureColor
            )
        }
    }

    private func statCard(label: String, value: String, unit: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(color)
                Spacer()
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1)
                    .foregroundColor(Color("TextSecondary"))
                HStack(alignment: .lastTextBaseline, spacing: 4) {
                    Text(value)
                        .font(.system(size: 24, weight: .heavy, design: .rounded))
                        .foregroundColor(Color("TextPrimary"))
                    Text(unit)
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                }
            }
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private var pressureColor: Color {
        let p = store.maxPressurePercent
        if p >= 90 { return Theme.statusError }
        if p >= 75 { return Theme.statusWarning }
        return Theme.statusSuccess
    }

    // MARK: - Quota editor

    private var quotaEditor: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "wallet")
                    .font(.system(size: 16))
                    .foregroundColor(Theme.statusWarning)
                Text("Shared runtime quota")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(Color("TextPrimary"))
            }

            Text("Update the hourly quota for the default runtime tenant.")
                .font(.caption)
                .foregroundColor(Color("TextSecondary"))

            HStack(spacing: 12) {
                TextField("Credits per hour", text: $quotaDraft)
                    .keyboardType(.decimalPad)
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(Color("BgPanel"))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusMD)
                            .stroke(Color("BorderSubtle"), lineWidth: 1)
                    )

                Button(action: applyQuota) {
                    HStack(spacing: 4) {
                        if store.isSavingQuota {
                            ProgressView()
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "dollarsign")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        Text("Apply")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.black)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Theme.statusWarning)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .buttonStyle(.plain)
                .disabled(store.isSavingQuota || quotaDraft.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            HStack(spacing: 8) {
                ForEach(quickQuotas, id: \.self) { quota in
                    Button(action: { quotaDraft = formatCredits(quota) }) {
                        Text("\(Int(quota)) cr")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(0.5)
                            .foregroundColor(Color("TextSecondary"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color("BgPanel"))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(Theme.borderWarmDefault, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            if let quotaError {
                Text(quotaError)
                    .font(.caption)
                    .foregroundColor(Theme.statusError)
            }

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Budget posture")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                    Text(pressureLabel)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(pressureColor)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Projected overrun")
                        .font(.caption)
                        .foregroundColor(Color("TextSecondary"))
                    Text("\(formatCredits(projectedOverrun)) credits")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(projectedOverrun > 0 ? Theme.statusError : Color("TextPrimary"))
                }
            }
            .padding(12)
            .background(Color("BgSecondary"))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private func applyQuota() {
        quotaError = nil
        guard let parsed = Double(quotaDraft), parsed.isFinite else {
            quotaError = "Enter a valid number"
            return
        }
        Task {
            do {
                try await store.setBudgetQuota(creditsPerHour: parsed)
            } catch {
                quotaError = error.localizedDescription
            }
        }
    }

    // MARK: - Metrics section

    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Resource pressure")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(Color("TextPrimary"))

            VStack(spacing: 10) {
                ForEach(store.budgetMetrics) { metric in
                    metricBar(metric)
                }
            }
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private func metricBar(_ metric: RuntimeBudgetMetric) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(metric.label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color("TextPrimary"))
                Spacer()
                Text(metric.detail)
                    .font(.caption)
                    .foregroundColor(toneColor(metric.tone))
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color("BgSecondary"))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(toneColor(metric.tone))
                        .frame(width: max(0, geo.size.width * CGFloat(metric.percent) / 100))
                }
            }
            .frame(height: 8)
        }
    }

    private func toneColor(_ tone: RuntimeBudgetMetric.Tone) -> Color {
        switch tone {
        case .healthy: return Theme.statusSuccess
        case .warning: return Theme.statusWarning
        case .critical: return Theme.statusError
        }
    }

    // MARK: - Alerts section

    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Alerts")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(Color("TextPrimary"))

            if store.budgetAlerts.isEmpty {
                Text("No alerts")
                    .font(.caption)
                    .foregroundColor(Color("TextSecondary"))
            } else {
                VStack(spacing: 8) {
                    ForEach(store.budgetAlerts.prefix(3)) { alert in
                        HStack(spacing: 10) {
                            Image(systemName: alert.level == .critical ? "exclamationmark.triangle.fill" : alert.level == .warning ? "exclamationmark.circle" : "info.circle")
                                .foregroundColor(alertColor(for: alert.level))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(alert.title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(Color("TextPrimary"))
                                Text(alert.message)
                                    .font(.caption)
                                    .foregroundColor(Color("TextSecondary"))
                                    .lineLimit(2)
                            }
                            Spacer()
                        }
                        .padding(12)
                        .background(alertColor(for: alert.level).opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    }
                }
            }
        }
        .padding(14)
        .background(Color("BgPanel"))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusLG)
                .stroke(Theme.borderWarmDefault, lineWidth: 1)
        )
    }

    private func alertColor(for level: RuntimeBudgetAlert.Level) -> Color {
        switch level {
        case .critical: return Theme.statusError
        case .warning: return Theme.statusWarning
        case .info: return Theme.statusInfo
        }
    }

    // MARK: - Formatting

    private func formatCredits(_ value: Double) -> String {
        guard value.isFinite else { return "0.0" }
        return value >= 10 ? String(format: "%.0f", value) : String(format: "%.1f", value)
    }
}
