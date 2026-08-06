import Foundation

// MARK: - Current user profile (for org gating)

struct CurrentUserProfile: Codable, Sendable {
    let id: String
    let email: String
    let name: String?
    let role: String
    let status: String
    let organizationId: String?
    let organizationRole: String?

    enum CodingKeys: String, CodingKey {
        case id, email, name, role, status
        case organizationId = "organization_id"
        case organizationRole = "organization_role"
    }
}

// MARK: - Enterprise usage

struct EnterpriseUsageLineItem: Codable, Sendable {
    let description: String
    let resourceType: String
    let quantity: Double
    let unit: String
    let subtotalCents: Int

    enum CodingKeys: String, CodingKey {
        case description
        case resourceType = "resource_type"
        case quantity
        case unit
        case subtotalCents = "subtotal_cents"
    }
}

struct EnterpriseUsageSummary: Codable, Sendable {
    let organizationId: String
    let periodStart: String
    let periodEnd: String
    let lineItems: [EnterpriseUsageLineItem]
    let totalCents: Int
    let sellerLegalName: String
    let sellerAddressLines: [String]
    let paymentTerms: String

    enum CodingKeys: String, CodingKey {
        case organizationId = "organization_id"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case lineItems = "line_items"
        case totalCents = "total_cents"
        case sellerLegalName = "seller_legal_name"
        case sellerAddressLines = "seller_address_lines"
        case paymentTerms = "payment_terms"
    }
}

// MARK: - Cloud credentials

enum CloudProvider: String, Codable, Sendable, CaseIterable, Identifiable {
    case aws
    case gcp
    case azure

    var id: String { rawValue }
}

struct CloudCredential: Identifiable, Codable, Sendable {
    let id: String
    let provider: CloudProvider
    let label: String
    let region: String?
    let externalId: String?
    let status: String
    let lastValidatedAt: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, provider, label, region
        case externalId = "external_id"
        case status
        case lastValidatedAt = "last_validated_at"
        case createdAt = "created_at"
    }
}

struct CloudCredentialCreateRequest: Encodable, Sendable {
    let provider: CloudProvider
    let label: String
    let region: String?
    let externalId: String?
    let secret: [String: String]

    enum CodingKeys: String, CodingKey {
        case provider, label, region
        case externalId = "external_id"
        case secret
    }
}

struct CloudCredentialTestRequest: Encodable, Sendable {
    let provider: CloudProvider
    let region: String?
    let externalId: String?
    let secret: [String: String]

    enum CodingKeys: String, CodingKey {
        case provider, region
        case externalId = "external_id"
        case secret
    }
}

struct CloudCredentialTestResult: Codable, Sendable {
    let success: Bool
    let message: String
}
