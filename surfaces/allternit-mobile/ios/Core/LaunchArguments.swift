import Foundation

/// Normalized access to process launch arguments.
///
/// Maestro serializes YAML arguments differently depending on the runner
/// version / platform: `key`, `-key`, `key=true`, and `-key=true` are all
/// observed in the wild. Use `launchArgumentEnabled(_:)` instead of raw
/// `CommandLine.arguments.contains` so audit deep-links stay reliable.
func launchArgumentEnabled(_ key: String) -> Bool {
    CommandLine.arguments.contains { arg in
        // Maestro serializes YAML launch arguments differently depending on
        // key format and runner state: `key`, `-key`, `--key`, `key=true`,
        // `-key=true`, and `--key=true` are all observed in the wild.
        var normalized = arg
        while normalized.hasPrefix("-") {
            normalized = String(normalized.dropFirst())
        }
        return normalized == key || normalized == "\(key)=true"
    }
}
