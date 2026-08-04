import Foundation

// MARK: - Deployment

struct Deployment: Identifiable, Codable, Sendable {
    let id: String
    let providerId: String
    let regionId: String
    let instanceTypeId: String
    let storageGb: Int
    let instanceName: String
    let status: String
    let progress: Int
    let message: String
    let errorMessage: String?
    let instanceId: String?
    let instanceIp: String?
    let createdAt: String
    let updatedAt: String
    let completedAt: String?

    enum CodingKeys: String, CodingKey {
        case id = "deployment_id"
        case providerId = "provider_id"
        case regionId = "region_id"
        case instanceTypeId = "instance_type_id"
        case storageGb = "storage_gb"
        case instanceName = "instance_name"
        case status
        case progress
        case message
        case errorMessage = "error_message"
        case instanceId = "instance_id"
        case instanceIp = "instance_ip"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case completedAt = "completed_at"
    }
}

// MARK: - Create request

struct DeploymentCreateRequest: Encodable, Sendable {
    let providerId: String
    let regionId: String
    let instanceTypeId: String
    let storageGb: Int
    let instanceName: String
    let mode: String
    let apiToken: String?
    let sshHost: String?
    let sshPort: Int?
    let sshUsername: String?
    let sshPrivateKey: String?

    enum CodingKeys: String, CodingKey {
        case providerId = "provider_id"
        case regionId = "region_id"
        case instanceTypeId = "instance_type_id"
        case storageGb = "storage_gb"
        case instanceName = "instance_name"
        case mode
        case apiToken = "api_token"
        case sshHost = "ssh_host"
        case sshPort = "ssh_port"
        case sshUsername = "ssh_username"
        case sshPrivateKey = "ssh_private_key"
    }
}

// MARK: - Live event

struct DeploymentEvent: Codable, Sendable {
    let deploymentId: String
    let eventType: String
    let progress: Int
    let message: String
    let timestamp: String
    let data: [String: String]?

    enum CodingKeys: String, CodingKey {
        case deploymentId = "deployment_id"
        case eventType = "event_type"
        case progress
        case message
        case timestamp
        case data
    }
}
