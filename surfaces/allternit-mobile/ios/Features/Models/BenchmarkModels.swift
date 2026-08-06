import Foundation
import Metal
import UIKit

/// Static device-capability info for the benchmark's spec card. iOS exposes
/// no public API for a friendly chip marketing name (e.g. "A17 Pro") — only
/// the raw hardware identifier (e.g. "iPhone16,2") — so that's what's shown,
/// same as most diagnostic tools do without a hand-maintained lookup table.
struct DeviceSpecs {
    let hardwareIdentifier: String
    let systemName: String
    let systemVersion: String
    let coreCount: Int
    let physicalMemoryBytes: UInt64
    /// Metal device name (e.g. "Apple A17 Pro GPU") — nil on the simulator
    /// or if Metal is unavailable.
    let gpuName: String?

    @MainActor
    static func current() -> DeviceSpecs {
        var systemInfo = utsname()
        uname(&systemInfo)
        let identifier = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
        }

        return DeviceSpecs(
            hardwareIdentifier: identifier,
            systemName: UIDevice.current.systemName,
            systemVersion: UIDevice.current.systemVersion,
            coreCount: ProcessInfo.processInfo.processorCount,
            physicalMemoryBytes: ProcessInfo.processInfo.physicalMemory,
            gpuName: MTLCreateSystemDefaultDevice()?.name
        )
    }

    var memoryLabel: String {
        ByteCountFormatter.string(fromByteCount: Int64(physicalMemoryBytes), countStyle: .memory)
    }
}

/// One persisted benchmark run. Timing is client-side wall clock over the
/// SAME network round-trip the regular chat composer uses (there's no
/// on-device model to benchmark the way PocketPal does against local
/// llama.cpp — Allternit's local-model hosting runs on a paired
/// desktop/VPS/cloud runtime, never in-process on the phone, see
/// docs/Audits_and_Research/BYOC_DESKTOP_CLOUD_IOS_ARCHITECTURE_AUDIT.md).
/// `~` in `approxTokensPerSecond` is load-bearing: it's a chars/4 estimate,
/// not a real tokenizer count, same caveat as MessageRecord.PerfStats.
struct BenchmarkResult: Identifiable, Codable, Equatable {
    let id: UUID
    let modelId: String
    let modelLabel: String
    let ranAt: Date
    let timeToFirstToken: TimeInterval
    let generationDuration: TimeInterval
    let approxTokenCount: Int
    let deviceIdentifier: String

    var approxTokensPerSecond: Double {
        generationDuration > 0 ? Double(approxTokenCount) / generationDuration : 0
    }
}

/// Persisted history (UserDefaults, JSON-encoded — same pattern ModelStore
/// uses for its own small persisted state; no need for SwiftData/Core Data
/// at this size). Newest first, same as PocketPal's BenchmarkStore.
@MainActor
final class BenchmarkStore: ObservableObject {
    static let shared = BenchmarkStore()

    @Published private(set) var results: [BenchmarkResult] = []

    private let defaults: UserDefaults
    private static let storageKey = "allternit-benchmark-results"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    func add(_ result: BenchmarkResult) {
        results.insert(result, at: 0)
        save()
    }

    func remove(_ id: UUID) {
        results.removeAll { $0.id == id }
        save()
    }

    func clear() {
        results = []
        save()
    }

    func results(forModelId modelId: String) -> [BenchmarkResult] {
        results.filter { $0.modelId == modelId }
    }

    private func load() {
        guard let data = defaults.data(forKey: Self.storageKey),
              let decoded = try? JSONDecoder().decode([BenchmarkResult].self, from: data) else { return }
        results = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(results) else { return }
        defaults.set(data, forKey: Self.storageKey)
    }
}
