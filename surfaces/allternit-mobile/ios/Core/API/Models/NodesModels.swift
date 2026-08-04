import Foundation

// MARK: - Node status

enum NodeStatus: String, Codable, Sendable, CaseIterable {
    case online
    case offline
    case busy
    case maintenance
    case error
}

// MARK: - Node record

struct NodeRecord: Identifiable, Codable, Sendable {
    let id: String
    let userId: String
    let hostname: String
    let version: String
    let dockerAvailable: Bool
    let gpuAvailable: Bool
    let cpuCores: Int
    let memoryGB: Int
    let diskGB: Int
    let os: String
    let arch: String
    let labels: [String]
    let status: NodeStatus
    let createdAt: String
    let updatedAt: String
    let lastSeenAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case hostname
        case version
        case dockerAvailable = "docker_available"
        case gpuAvailable = "gpu_available"
        case cpuCores = "cpu_cores"
        case memoryGB = "memory_gb"
        case diskGB = "disk_gb"
        case os
        case arch
        case labels
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case lastSeenAt = "last_seen_at"
    }
}

// MARK: - Response envelopes

struct NodesResponse: Codable, Sendable {
    let connected: [String]
    let allNodes: [NodeRecord]
    let count: Int
    let totalNodes: Int

    enum CodingKeys: String, CodingKey {
        case connected
        case allNodes = "all_nodes"
        case count
        case totalNodes = "total_nodes"
    }
}

struct NodeTokenResponse: Codable, Sendable {
    let nodeId: String
    let token: String
    let installCommand: String

    enum CodingKeys: String, CodingKey {
        case nodeId = "node_id"
        case token
        case installCommand = "install_command"
    }
}
