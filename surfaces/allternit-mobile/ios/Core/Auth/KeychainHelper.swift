import Foundation
import Security

/// Minimal Keychain wrapper for the app's own secrets (steering review, D3).
/// The app previously persisted no raw bearer secrets of its own (the session
/// token is handled inside the Clerk SDK), so no helper existed — the brain's
/// `allternit_git_` token is the first, and UserDefaults (plaintext plist, no
/// hardware-backed protection) was the wrong place for it. Generic-password
/// items, this device's sandbox only, no access-group sharing.
enum KeychainHelper {
    private static let service = "com.allternit.mobile"

    /// Insert-or-update a string value for `account`.
    static func save(_ value: String, for account: String) {
        let data = Data(value.utf8)
        let query = baseQuery(account)
        let attributes: [CFString: Any] = [kSecValueData: data]
        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
            var item = query
            item[kSecValueData] = data
            SecItemAdd(item as CFDictionary, nil)
        }
    }

    /// The stored string for `account`, or nil when absent/unreadable.
    static func load(_ account: String) -> String? {
        var query = baseQuery(account)
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ account: String) {
        SecItemDelete(baseQuery(account) as CFDictionary)
    }

    private static func baseQuery(_ account: String) -> [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
    }
}
