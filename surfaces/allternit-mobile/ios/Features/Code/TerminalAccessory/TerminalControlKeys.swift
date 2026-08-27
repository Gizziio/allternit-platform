import Foundation

/// The fixed control-key row above the terminal keyboard: raw byte
/// sequences a pty expects for keys the system keyboard doesn't have a
/// direct mapping for. Dedicated Ctrl-C/Ctrl-D/Ctrl-Z buttons ship in v1
/// rather than a general sticky Ctrl modifier — simpler to get right, and
/// covers the commands people actually reach for (interrupt, EOF, suspend).
enum TerminalControlKey: CaseIterable {
    case escape, tab, arrowUp, arrowDown, arrowLeft, arrowRight, ctrlC, ctrlD, ctrlZ

    var label: String {
        switch self {
        case .escape: return "esc"
        case .tab: return "tab"
        case .arrowUp: return "↑"
        case .arrowDown: return "↓"
        case .arrowLeft: return "←"
        case .arrowRight: return "→"
        case .ctrlC: return "^C"
        case .ctrlD: return "^D"
        case .ctrlZ: return "^Z"
        }
    }

    /// Raw bytes to write to the pty's stdin.
    var bytes: [UInt8] {
        switch self {
        case .escape: return [0x1B]
        case .tab: return [0x09]
        case .arrowUp: return [0x1B, 0x5B, 0x41]      // ESC [ A
        case .arrowDown: return [0x1B, 0x5B, 0x42]    // ESC [ B
        case .arrowRight: return [0x1B, 0x5B, 0x43]   // ESC [ C
        case .arrowLeft: return [0x1B, 0x5B, 0x44]    // ESC [ D
        case .ctrlC: return [0x03]
        case .ctrlD: return [0x04]
        case .ctrlZ: return [0x1A]
        }
    }
}
