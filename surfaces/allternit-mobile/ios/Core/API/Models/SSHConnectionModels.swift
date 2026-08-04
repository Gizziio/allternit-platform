import Foundation

// MARK: - SSH connection status

enum SSHConnectionStatus: String, Codable, Sendable {
    case connected
    case disconnected
    case connecting
    case error
}

// MARK: - SSH connection

struct SSHConnection: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let host: String
    let port: Int
    let username: String
    let status: SSHConnectionStatus
    let lastConnected: String?
    let os: String?
    let architecture: String?
    let dockerInstalled: Bool?
    let allternitInstalled: Bool?
    let errorMessage: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, host, port, username, status
        case lastConnected = "last_connected"
        case os, architecture
        case dockerInstalled = "docker_installed"
        case allternitInstalled = "allternit_installed"
        case errorMessage = "error_message"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Requests / responses

struct SSHConnectionCreateRequest: Encodable, Sendable {
    let name: String
    let host: String
    let port: Int
    let username: String
    let authType: String
    let privateKey: String?
    let password: String?

    enum CodingKeys: String, CodingKey {
        case name, host, port, username
        case authType = "auth_type"
        case privateKey = "private_key"
        case password
    }
}

struct SSHConnectionTestResponse: Codable, Sendable {
    let success: Bool
    let message: String
    let os: String?
    let architecture: String?
    let dockerInstalled: Bool?
    let allternitInstalled: Bool?

    enum CodingKeys: String, CodingKey {
        case success, message, os, architecture
        case dockerInstalled = "docker_installed"
        case allternitInstalled = "allternit_installed"
    }
}
