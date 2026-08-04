import Foundation

// MARK: - Wizard session

struct CloudWizardSession: Identifiable, Codable, Sendable {
    let id: String
    let currentStep: String
    let context: CloudWizardContext
    let retryCount: Int
    let maxRetries: Int

    enum CodingKeys: String, CodingKey {
        case id = "deployment_id"
        case currentStep = "current_step"
        case context
        case retryCount = "retry_count"
        case maxRetries = "max_retries"
    }
}

struct CloudWizardContext: Codable, Sendable {
    let provider: String?
    let authMethod: String?
    let region: String?
    let instanceType: String?
    let instanceName: String?
    let storageGb: Int?
    let sshHost: String?
    let sshPort: Int?
    let sshUsername: String?
    let instanceId: String?
    let instanceIp: String?
    let agentGuidance: [String]?

    enum CodingKeys: String, CodingKey {
        case provider
        case authMethod = "auth_method"
        case region
        case instanceType = "instance_type"
        case instanceName = "instance_name"
        case storageGb = "storage_gb"
        case sshHost = "ssh_host"
        case sshPort = "ssh_port"
        case sshUsername = "ssh_username"
        case instanceId = "instance_id"
        case instanceIp = "instance_ip"
        case agentGuidance = "agent_guidance"
    }
}

// MARK: - Start request (manual-only phase 1)

struct CloudWizardStartRequest: Encodable, Sendable {
    let provider: String
    let sshHost: String
    let sshPort: Int
    let sshUsername: String
    let sshPrivateKey: String?
    let sshPassword: String?
    let instanceName: String?

    enum CodingKeys: String, CodingKey {
        case provider
        case sshHost = "ssh_host"
        case sshPort = "ssh_port"
        case sshUsername = "ssh_username"
        case sshPrivateKey = "ssh_private_key"
        case sshPassword = "ssh_password"
        case instanceName = "instance_name"
    }
}

// MARK: - Bootstrap result

struct CloudBootstrapResult: Codable, Sendable {
    let deploymentId: String
    let status: String
    let meshIp: String
    let instanceName: String
    let url: String
    let wizard: CloudWizardSession?

    enum CodingKeys: String, CodingKey {
        case deploymentId = "deployment_id"
        case status
        case meshIp = "mesh_ip"
        case instanceName = "instance_name"
        case url
        case wizard
    }
}
