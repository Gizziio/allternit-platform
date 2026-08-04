import Foundation

// -----------------------------------------------------------------------------
// Runtime Operations models — mirrors the web shapes in
// RuntimeOperationsView.tsx and its hooks (useBudget, useReplay, usePrewarm,
// useRuntimeExecutionMode).
// -----------------------------------------------------------------------------

// MARK: - Budget

struct RuntimeBudgetStatus: Codable, Sendable {
    let creditsRemaining: Double
    let creditsConsumedThisHour: Double
    let projectedHourlyCost: Double
    let status: String
    let cpuPercent: Double
    let memoryPercent: Double
    let networkPercent: Double
    let workerPercent: Double

    enum CodingKeys: String, CodingKey {
        case creditsRemaining = "credits_remaining"
        case creditsConsumedThisHour = "credits_consumed_this_hour"
        case projectedHourlyCost = "projected_hourly_cost"
        case status
        case cpuPercent = "cpu_percent"
        case memoryPercent = "memory_percent"
        case networkPercent = "network_percent"
        case workerPercent = "worker_percent"
    }
}

struct RuntimeBudgetMetric: Identifiable, Codable, Sendable {
    enum Key: String, Codable, Sendable {
        case cpu, memory, network, workers
    }

    enum Tone: String, Codable, Sendable {
        case healthy, warning, critical
    }

    let key: Key
    let label: String
    let percent: Double
    let tone: Tone
    let detail: String

    var id: String { key.rawValue }
}

struct RuntimeBudgetAlert: Identifiable, Codable, Sendable {
    enum Level: String, Codable, Sendable {
        case info, warning, critical
    }

    let level: Level
    let title: String
    let message: String
    var id: String { title + message }
}

struct RuntimeBudgetQuotaUpdate: Codable, Sendable {
    let status: String
    let creditsPerHour: Double
    let tenantId: String

    enum CodingKeys: String, CodingKey {
        case status
        case creditsPerHour = "credits_per_hour"
        case tenantId = "tenant_id"
    }
}

// MARK: - Replay

struct ReplayManifest: Identifiable, Codable, Sendable {
    let runId: String
    let captureLevel: String
    let outputCount: Int
    let timestampCount: Int

    enum CodingKeys: String, CodingKey {
        case runId = "run_id"
        case captureLevel = "capture_level"
        case outputCount = "output_count"
        case timestampCount = "timestamp_count"
    }

    var id: String { runId }
}

struct ReplayExecutionResult: Codable, Sendable {
    let status: String
    let sessionId: String
    let canReplay: Bool
}

// MARK: - Prewarm

enum PoolHealth: String, Codable, Sendable {
    case healthy
    case degraded
    case empty
}

struct PoolStatus: Identifiable, Codable, Sendable {
    let name: String
    let image: String
    let poolSize: Int
    let availableCount: Int
    let inUseCount: Int
    let warmingUpCount: Int
    let status: PoolHealth
    let createdAt: String
    let lastActivity: String

    enum CodingKeys: String, CodingKey {
        case name, image, status
        case poolSize = "pool_size"
        case availableCount = "available_count"
        case inUseCount = "in_use_count"
        case warmingUpCount = "warming_up_count"
        case createdAt = "created_at"
        case lastActivity = "last_activity"
    }

    var id: String { name }
}

struct PoolStats: Codable, Sendable {
    let totalPools: Int
    let totalInstances: Int
    let totalAvailable: Int
    let totalInUse: Int
    let totalWarmupsPerformed: Int
    let totalReuses: Int
    let avgWarmupTimeMs: Double

    enum CodingKeys: String, CodingKey {
        case totalPools = "total_pools"
        case totalInstances = "total_instances"
        case totalAvailable = "total_available"
        case totalInUse = "total_in_use"
        case totalWarmupsPerformed = "total_warmups_performed"
        case totalReuses = "total_reuses"
        case avgWarmupTimeMs = "avg_warmup_time_ms"
    }
}

struct PrewarmStatus: Codable, Sendable {
    let enabled: Bool
    let poolSize: Int
    let availableInstances: Int
    let inUseInstances: Int
    let pools: [BackendPoolStatus]

    enum CodingKeys: String, CodingKey {
        case enabled
        case poolSize = "pool_size"
        case availableInstances = "available_instances"
        case inUseInstances = "in_use_instances"
        case pools
    }
}

struct BackendPoolStatus: Codable, Sendable {
    let name: String
    let available: Int
    let inUse: Int
    let poolSize: Int

    enum CodingKeys: String, CodingKey {
        case name
        case available
        case inUse = "in_use"
        case poolSize = "pool_size"
    }
}

// MARK: - Execution mode

enum RuntimeExecutionMode: String, Codable, Sendable {
    case plan
    case safe
    case auto
}

struct RuntimeExecutionModeStatus: Codable, Sendable {
    let mode: RuntimeExecutionMode
    let supportedModes: [RuntimeExecutionMode]

    enum CodingKeys: String, CodingKey {
        case mode
        case supportedModes = "supported_modes"
    }
}
